import {
  definePlugin,
  addEventListener,
  removeEventListener,
  toaster,
} from "@decky/api";
import { FaRocket } from "react-icons/fa";
import { loadTranslations } from "./i18n";
import { staticClasses } from "@decky/ui";
import { Home } from "./screens/Home";

export default definePlugin(() => {
  console.log("Proton Launch plugin initializing");

  loadTranslations();

  const listener = addEventListener("timer_event", (...args) => {
    toaster.toast({ title: "Event received", body: JSON.stringify(args) });
  });

  return {
    name: "decky-proton-launch",
    titleView: <div className={staticClasses.Title}>Proton Launch</div>,
    content: <Home />,
    icon: <FaRocket />,
    onDismount() {
      removeEventListener("timer_event", listener);
      console.log("Plugin unloaded");
    },
  };
});
