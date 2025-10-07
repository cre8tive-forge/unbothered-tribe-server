export const cuid = (length) => {
  let result = "";
  const text = "abcdefghijklmnopqrstuvwxyz1234567890";
  const textlength = text.length;
  for (let i = 0; i < length; i++) {
    result += text.charAt(Math.floor(Math.random() * textlength));
  }
  return result;
};
