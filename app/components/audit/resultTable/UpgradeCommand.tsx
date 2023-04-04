import { CopyIcon } from "@radix-ui/react-icons";
import CopyToClipboard from "react-copy-to-clipboard";

export function UpgradeCommand({ command }: { command: string }) {
  return (
    <div className="flex items-center rounded-full bg-slate-800 px-4 py-1">
      <span className="font-mono text-lg font-bold text-lime-500">{">"}</span>
      <span className="font-sm max-w-[600px] overflow-x-auto whitespace-nowrap pl-1 text-white">
        {command}
      </span>
      <CopyToClipboard text={command}>
        <button className="ml-2 rounded-full p-1 text-white hover:bg-white hover:text-slate-800">
          <CopyIcon className="text-inherit" />
        </button>
      </CopyToClipboard>
    </div>
  );
}
