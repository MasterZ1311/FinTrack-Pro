/**
 * @vitest-environment jsdom
 * FinTrack Pro — Dialog & Toast Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { showToast, confirmModal, alertModal, promptModal } from '../../src/utils/dialog.js';

describe('UI Feedback & Dialog System (src/utils/dialog.js)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const existingStyles = document.getElementById('fintrack-dialog-styles');
    if (existingStyles) existingStyles.remove();
  });

  it('renders a toast notification with the specified message and class', async () => {
    showToast('Transaction saved successfully!', 'success', 2000);
    const container = document.getElementById('fintrack-toast-container');
    expect(container).not.toBeNull();

    const toast = container.querySelector('.fintrack-toast');
    expect(toast).not.toBeNull();
    expect(toast.classList.contains('toast-success')).toBe(true);
    expect(toast.textContent).toContain('Transaction saved successfully!');
  });

  it('resolves confirmModal with true when Confirm button is clicked', async () => {
    const promise = confirmModal({
      title: 'Delete Item',
      message: 'Are you sure?',
      confirmText: 'Delete',
      danger: true,
    });

    const backdrop = document.querySelector('.fintrack-modal-backdrop');
    expect(backdrop).not.toBeNull();
    expect(backdrop.textContent).toContain('Delete Item');
    expect(backdrop.textContent).toContain('Are you sure?');

    const confirmBtn = backdrop.querySelector('#fintrack-dlg-confirm');
    expect(confirmBtn).not.toBeNull();
    confirmBtn.click();

    const result = await promise;
    expect(result).toBe(true);
  });

  it('resolves confirmModal with false when Cancel button is clicked', async () => {
    const promise = confirmModal({
      title: 'Discard Changes',
      message: 'Discard all edits?',
    });

    const backdrop = document.querySelector('.fintrack-modal-backdrop');
    const cancelBtn = backdrop.querySelector('#fintrack-dlg-cancel');
    cancelBtn.click();

    const result = await promise;
    expect(result).toBe(false);
  });

  it('resolves alertModal when Dismiss button is clicked', async () => {
    const promise = alertModal({
      title: 'Action Failed',
      message: 'Network offline',
      type: 'danger',
    });

    const backdrop = document.querySelector('.fintrack-modal-backdrop');
    expect(backdrop.textContent).toContain('Action Failed');
    expect(backdrop.textContent).toContain('Network offline');

    const okBtn = backdrop.querySelector('#fintrack-dlg-ok');
    okBtn.click();

    await promise;
  });

  it('resolves promptModal with entered text on Submit and null on Cancel', async () => {
    const promise = promptModal({
      title: 'New Goal Name',
      message: 'Enter name:',
      defaultValue: 'Vacation Fund',
    });

    const backdrop = document.querySelector('.fintrack-modal-backdrop');
    const input = backdrop.querySelector('#fintrack-dlg-input');
    expect(input.value).toBe('Vacation Fund');
    input.value = 'Home Renovation';

    const submitBtn = backdrop.querySelector('#fintrack-dlg-submit');
    submitBtn.click();

    const result = await promise;
    expect(result).toBe('Home Renovation');
  });
});
