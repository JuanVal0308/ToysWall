/**
 * Interfaz de autenticación (UML: IAutenticacion).
 * Contrato: autenticar(correo, password) debe retornar Usuario o null.
 * @interface
 */
// En JS no hay interfaces; se documenta el contrato.
// Implementaciones: AutenticacionSupabase
window.IAutenticacion = Object.freeze({
  /**
   * Autentica un usuario por correo y contraseña.
   * @param {string} correo
   * @param {string} password
   * @returns {Promise<Usuario|null>} Usuario si las credenciales son válidas, null en caso contrario.
   */
  autenticar: async (correo, password) => { throw new Error('Implementar autenticar(correo, password)'); }
});
