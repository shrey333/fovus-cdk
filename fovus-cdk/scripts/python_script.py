import sys
import boto3
import os
from botocore.exceptions import ClientError

aws_region = "us-east-1"

dynamodb = boto3.resource(
    "dynamodb",
    region_name=aws_region,
)
s3 = boto3.client(
    "s3",
    region_name=aws_region,
)


def parse_bucket_and_key(input_file_path):
    parts = input_file_path.split("/")
    bucket_name = parts[0]
    file_key = "/".join(parts[1:])
    return bucket_name, file_key


def get_input_text_and_file(id, table_name):
    try:
        table = dynamodb.Table(table_name)
        response = table.get_item(Key={"id": id})
        item = response.get("Item")
        if item:
            input_text = item.get("input_text")
            input_file_path = item.get("input_file_path")
            return input_text, input_file_path
        else:
            return None, None
    except ClientError as e:
        print(f"Error getting item from DynamoDB: {e}")
        return None, None


def download_file_from_s3(bucket_name, file_key, destination_file):
    try:
        s3.download_file(bucket_name, file_key, destination_file)
    except ClientError as e:
        print(f"Error downloading file from S3: {e}")


def append_input_text_to_file(input_text, input_file_path):
    try:
        with open(input_file_path, "a") as file:
            file.write(f"\n{input_text}")
    except IOError as e:
        print(f"Error appending input text to file: {e}")


def upload_file_to_s3(bucket_name, file_path, output_file_key):
    try:
        s3.upload_file(file_path, bucket_name, output_file_key)
    except ClientError as e:
        print(f"Error uploading file to S3: {e}")


def update_dynamodb_table(table_name, id, output_file_key):
    try:
        table = dynamodb.Table(table_name)
        response = table.update_item(
            Key={"id": id},
            UpdateExpression="SET output_file_path = :val1",
            ExpressionAttributeValues={":val1": output_file_key},
        )
    except ClientError as e:
        print(f"Error updating DynamoDB table: {e}")


def main(id, table_name):
    input_text, input_file_path = get_input_text_and_file(id, table_name)
    if input_text and input_file_path:
        bucket_name_input, file_key = parse_bucket_and_key(input_file_path)
        download_file_from_s3(bucket_name_input, file_key, file_key)
        append_input_text_to_file(input_text, file_key)

        file_name, extension = os.path.splitext(file_key)
        new_file_key = f"{file_name}_output{extension}"

        upload_file_to_s3(bucket_name_input, file_key, new_file_key)
        update_dynamodb_table(table_name, id, f"{bucket_name_input}/{new_file_key}")
        print("Process completed successfully.")
    else:
        print("Invalid ID or data not found.")


if __name__ == "__main__":
    id = sys.argv[1]
    table_name = sys.argv[2]
    main(id, table_name)
