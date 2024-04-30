import { FileInput, Label, Button, TextInput } from "flowbite-react";
import "./App.css";
import { Field, Form, Formik, FormikHelpers } from "formik";
import * as Yup from "yup";
import { ChangeEvent } from "react";
import { PutObjectCommand, S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import axios from "axios";

const formSchema = Yup.object({
  textInput: Yup.string().required("Text input is required"),
  fileInput: Yup.array()
    .min(1, "Please upload file")
    .max(1, "Please upload file"),
});

type FormType = Yup.InferType<typeof formSchema>;

const s3ClientConfig: S3ClientConfig = {
  region: import.meta.env.VITE_REACT_APP_REGION ?? "",
  credentials: {
    accessKeyId: import.meta.env.VITE_REACT_APP_ACCESS ?? "",
    secretAccessKey: import.meta.env.VITE_REACT_APP_SECRET ?? "",
  },
};

const initialValues: FormType = {
  textInput: "",
  fileInput: [],
} as FormType;

function App() {
  const uploadFile = async (file: File) => {
    const s3Client = new S3Client(s3ClientConfig);
    const objectParams = {
      Bucket: import.meta.env.VITE_REACT_APP_BUCKET_NAME ?? "",
      Key: file.name,
      Body: file,
      ContentType: file.type,
    };
    await s3Client.send(new PutObjectCommand(objectParams));
  };

  const onSubmit = async (
    values: FormType,
    { setSubmitting }: FormikHelpers<FormType>
  ) => {
    setSubmitting(true);
    const file = values.fileInput?.[0];
    await uploadFile(file)
      .then(async () => {
        await axios.post(import.meta.env.VITE_REACT_APP_API_URL ?? "", {
          input_text: values.textInput,
          input_file_path:
            import.meta.env.VITE_REACT_APP_BUCKET_NAME + file.name,
        });
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <>
      <Formik
        initialValues={initialValues}
        validationSchema={formSchema}
        onSubmit={onSubmit}
      >
        {({ setFieldValue, errors, touched, isSubmitting }) => (
          <Form className="text-start">
            <div className="mb-6">
              <div className="mb-2 text-start">
                <Label htmlFor="text-input" value="Text input" />
              </div>
              <Field
                id="text-input"
                component={TextInput}
                name="textInput"
                color={
                  errors.textInput && touched.textInput ? "failure" : "primary"
                }
                type="text"
                label="Text Input"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setFieldValue("textInput", event.currentTarget.value);
                }}
                helperText={
                  errors.textInput && touched.textInput && errors.textInput
                }
              />
            </div>
            <div className="mb-6 text-start">
              <div className="mb-2">
                <Label htmlFor="file-upload" value="File input" />
              </div>
              <Field
                id="file-upload"
                component={FileInput}
                name="fileInput"
                label="File Input"
                color={
                  errors.fileInput && touched.fileInput ? "failure" : "primary"
                }
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  if (event.currentTarget.files) {
                    setFieldValue(
                      "fileInput",
                      Array.from(event.currentTarget.files)
                    );
                  }
                }}
                helperText={
                  errors.fileInput && touched.fileInput
                    ? errors.fileInput
                    : "Only TXT files are allowed"
                }
              />
            </div>
            <Button
              type="submit"
              isProcessing={isSubmitting}
              disabled={isSubmitting}
            >
              Submit
            </Button>
          </Form>
        )}
      </Formik>
    </>
  );
}

export default App;
