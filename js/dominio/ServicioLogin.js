/**
 * Servicio de login (UML: ServicioLogin).
 * Depende de IAutenticacion para autenticar.
 */
class ServicioLogin {
  /**
   * @param {Object} autenticador - Objeto que implementa IAutenticacion (método autenticar(correo, password))
   */
  constructor(autenticador) {
    this.autenticador = autenticador;
  }

  /**
   * @param {string} correo
   * @param {string} password
   * @returns {Promise<Usuario|null>}
   */
  async login(correo, password) {
    if (!this.autenticador || typeof this.autenticador.autenticar !== 'function') {
      throw new Error('ServicioLogin: autenticador debe implementar autenticar(correo, password)');
    }
    return this.autenticador.autenticar(correo, password);
  }
}

window.ServicioLogin = ServicioLogin;
