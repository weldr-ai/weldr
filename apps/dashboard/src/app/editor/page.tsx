import dynamic from "next/dynamic";

const Editor = dynamic(() => import("~/components/editor"), { ssr: false });

export default function EditorPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <div className="flex h-[500px] w-full max-w-xl rounded-xl border bg-muted p-10 shadow-md">
        <Editor />
      </div>
    </div>
  );
}
