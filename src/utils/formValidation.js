/**
 * Surface a browser validation failure.
 *
 * Native constraint validation blocks submit before any onSubmit handler
 * runs. The bubble the browser shows is easy to miss on a long form, and on
 * a field inside a collapsed section it cannot be shown at all. Without
 * this, a rejected field looks like a Save button that does nothing, which
 * is exactly how a step="0.1" constraint once made saving a meal
 * impossible with no visible error.
 *
 * Attach the result as onInvalidCapture on a form. The invalid event does
 * not bubble, so the capture phase is what reaches a nested field.
 *
 * @param {{error: Function}} toast - Toast API
 * @returns {Function} An onInvalidCapture handler
 */
export function reportInvalidField(toast) {
  return (event) => {
    const field = event.target;
    const label =
      field.labels?.[0]?.textContent?.replace('*', '').trim() ||
      field.getAttribute('aria-label') ||
      field.name ||
      'A field';
    toast.error(`${label}: ${field.validationMessage}`);
  };
}

export default reportInvalidField;
