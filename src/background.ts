import { setIsHidden } from "./utils";

chrome.runtime.onInstalled.addListener(() => {
  setIsHidden(false).catch(console.log);
});
