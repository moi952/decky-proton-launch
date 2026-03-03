import { toaster } from "@decky/api";

export const copy = async (text: string) => {
  try {
    const tempInput = document.createElement("input");
    tempInput.value = text;
    tempInput.style.position = "absolute";
    tempInput.style.left = "-9999px";

    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();

    const success = document.execCommand("copy");

    document.body.removeChild(tempInput);

    if (success) {
      toaster.toast({
        title: "Copied",
        body: text,
      });
    } else {
      throw new Error("execCommand failed");
    }
  } catch (err) {
    toaster.toast({
      title: "Copy Failed",
      body: "Unable to copy to clipboard",
    });
  }
};
