/* ==========================================================================
   Confirmation Dialog — SweetAlert2 Wrapper
   Replaces native confirm() with a modern, styled modal.
   ========================================================================== */

import Swal from 'sweetalert2';

/**
 * Shows a confirmation dialog. Returns true if the user confirms, false otherwise.
 * Mirrors the native confirm() API but async.
 */
export async function confirmAction(message: string, title?: string): Promise<boolean> {
  const result = await Swal.fire({
    title: title || 'Confirmar',
    text: message,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, continuar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    buttonsStyling: true,
    customClass: {
      popup: 'swal-custom-popup',
      confirmButton: 'swal-confirm-btn',
      cancelButton: 'swal-cancel-btn'
    }
  });
  return result.isConfirmed;
}

/**
 * Shows a danger/destructive confirmation dialog (red confirm button).
 */
export async function confirmDanger(message: string, title?: string): Promise<boolean> {
  const result = await Swal.fire({
    title: title || '¿Estás seguro?',
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    buttonsStyling: true,
    customClass: {
      popup: 'swal-custom-popup',
      confirmButton: 'swal-confirm-btn swal-danger-btn',
      cancelButton: 'swal-cancel-btn'
    }
  });
  return result.isConfirmed;
}
