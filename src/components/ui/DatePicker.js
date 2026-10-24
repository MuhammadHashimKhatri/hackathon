import Input from "./Input";

// Native date input: values are "YYYY-MM-DD" strings, never Date objects.
export default function DatePicker(props) {
  return <Input type="date" {...props} />;
}
