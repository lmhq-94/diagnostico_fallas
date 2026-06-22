/* ==========================================================================
   Toast Notification System — Notyf Wrapper
   ========================================================================== */

import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';

type ToastType = 'success' | 'error' | 'warning' | 'info';

let notyf: Notyf | null = null;

function getNotyf(): Notyf {
  if (!notyf) {
    notyf = new Notyf({
      duration: 4000,
      position: { x: 'right', y: 'top' },
      dismissible: true,
      ripple: false,
      types: [
        {
          type: 'success',
          background: '#059669',
          icon: {
            className: 'fas fa-check-circle',
            tagName: 'i',
            text: '',
            color: '#fff'
          }
        },
        {
          type: 'error',
          background: '#ef4444',
          icon: {
            className: 'fas fa-exclamation-circle',
            tagName: 'i',
            text: '',
            color: '#fff'
          }
        },
        {
          type: 'info',
          background: '#3b82f6',
          icon: {
            className: 'fas fa-info-circle',
            tagName: 'i',
            text: '',
            color: '#fff'
          }
        },
        {
          type: 'warning',
          background: '#f59e0b',
          icon: {
            className: 'fas fa-exclamation-triangle',
            tagName: 'i',
            text: '',
            color: '#fff'
          }
        }
      ]
    });
  }
  return notyf;
}

export function showToast(
  message: string,
  type: ToastType = 'info',
  duration?: number
): void {
  const n = getNotyf();

  switch (type) {
    case 'success':
      n.success(duration != null ? { message, duration } : message);
      break;
    case 'error':
      n.error(duration != null ? { message, duration } : message);
      break;
    case 'warning':
      n.open({ type: 'warning', message, duration });
      break;
    case 'info':
      n.open({ type: 'info', message, duration });
      break;
  }
}
