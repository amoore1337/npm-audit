import { Form } from "@remix-run/react";
import { Button, TextArea } from "../base";

export function PackageEntryForm({ loading }: { loading: boolean }) {
  return (
    <Form method="post" className="relative flex w-full flex-grow flex-col">
      <TextArea
        placeholder="Enter your package.json content. Only 'dependencies' and/or 'devDependencies' are required."
        name="packagejson"
        className="flex-grow !border-green-500 bg-green-100 font-mono placeholder:italic placeholder:text-green-600"
      />
      <div className="item-center flex justify-end pt-4">
        <Button variant="primary">{loading ? "Loading..." : "Submit"}</Button>
      </div>
    </Form>
  );
}
