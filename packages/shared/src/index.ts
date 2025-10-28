export * from "./shapeFlags";
export function isObject(value) {
  return typeof value === "object" && value !== null;
}
export function isFunction(value) {
  return typeof value === "function" && value !== null;
}

export function isString(value) {
  return typeof value === "string" && value !== null;
}

const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hadOwn = (value, key) => hasOwnProperty.call(value, key);
