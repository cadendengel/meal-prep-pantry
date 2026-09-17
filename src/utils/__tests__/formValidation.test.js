import { describe, it, expect, vi } from 'vitest';
import { reportInvalidField } from '../formValidation.js';

function makeEvent({ label, ariaLabel, name, message }) {
  return {
    target: {
      labels: label ? [{ textContent: label }] : undefined,
      getAttribute: (attr) => (attr === 'aria-label' ? ariaLabel : null),
      name,
      validationMessage: message,
    },
  };
}

describe('reportInvalidField', () => {
  it('names the field from its label and repeats the browser message', () => {
    const toast = { error: vi.fn() };
    reportInvalidField(toast)(makeEvent({
      label: 'Servings used', message: 'Please enter a valid value.',
    }));
    expect(toast.error).toHaveBeenCalledWith('Servings used: Please enter a valid value.');
  });

  it('strips the required marker from the label', () => {
    const toast = { error: vi.fn() };
    reportInvalidField(toast)(makeEvent({
      label: 'Meal Name *', message: 'Fill in this field.',
    }));
    expect(toast.error).toHaveBeenCalledWith('Meal Name: Fill in this field.');
  });

  it('falls back to aria-label when there is no label element', () => {
    const toast = { error: vi.fn() };
    reportInvalidField(toast)(makeEvent({ ariaLabel: 'Barcode', message: 'Bad.' }));
    expect(toast.error).toHaveBeenCalledWith('Barcode: Bad.');
  });

  it('falls back to the field name', () => {
    const toast = { error: vi.fn() };
    reportInvalidField(toast)(makeEvent({ name: 'price', message: 'Bad.' }));
    expect(toast.error).toHaveBeenCalledWith('price: Bad.');
  });

  it('still reports something when the field is anonymous', () => {
    const toast = { error: vi.fn() };
    reportInvalidField(toast)(makeEvent({ message: 'Bad.' }));
    expect(toast.error).toHaveBeenCalledWith('A field: Bad.');
  });
});
