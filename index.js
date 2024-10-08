document.addEventListener("DOMContentLoaded", () => {
  console.log("loaded index dom");
});
console.log("loaded index");

const hiddenSymbol = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
</svg>
`;
const visibleSymbol = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>
`;

const dataTypeAttribute = "data-hide-sensitive-information-type";

chrome.storage.sync.get("isHidden", (data) => {
  toggleHiddenMode(data.isHidden);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "change-hidden-mode") {
    toggleHiddenMode(request.isHidden);
  }
});

function toggleHiddenMode(hidden) {
  console.log("Toggling hidden mode:", hidden);
  if (!hidden) return;
  toggleEmail();
}

function toggleEmail() {
  // email regex: https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression
  const uglyRegex = RegExp(
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g
  );
  // get email inputs by id, name and obviously type. this can include duplicates but we don't care
  const possibleEmailInputs = [
    ...document.querySelectorAll(`input[id="mail"]`),
    ...document.querySelectorAll(`input[id="email"]`),
    ...document.querySelectorAll(`input[id="mail_address"]`),
    ...document.querySelectorAll(`input[id="email_address"]`),
    ...document.querySelectorAll(`input[name="mail"]`),
    ...document.querySelectorAll(`input[name="email"]`),
    ...document.querySelectorAll(`input[name="mail_address"]`),
    ...document.querySelectorAll(`input[name="email_address"]`),
    ...document.querySelectorAll(`input[type="email"]`),
  ];
  for (const email of possibleEmailInputs) {
    const value = email.value;
    if (uglyRegex.test(value)) {
      email.setAttribute(dataTypeAttribute, email.type);
      email.type = "password";
    }
  }
  const matches = document.body.innerHTML.matchAll(uglyRegex);
  for (const match of matches) {
    document.body.innerHTML = document.body.innerHTML.replace(
      match[0],
      match[0]
        .split("@")
        .map((e) => e.replace(/./g, "*"))
        .join("@")
    );
  }
}
