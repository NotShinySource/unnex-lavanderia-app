import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logoLavanderia from '../assets/logo.png';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  //const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password, /*rememberMe*/);
      window.location.href = '/';
      
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-spac-orange to-spac-orange-dark flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-spac-light rounded-full mb-4 overflow-hidden">
            <img 
              src={logoLavanderia} 
              alt="Logo Lavandería El Cobre" 
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-3xl font-bold text-spac-dark mb-2">
            Lavandería El Cobre SPA
          </h1>
          <p className="text-spac-gray">
            Inicio de Sesión
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-semibold text-spac-dark mb-2"
            >
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-spac-orange focus:border-transparent transition text-spac-dark"
              placeholder="tu@email.com"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-semibold text-spac-dark mb-2"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-spac-orange focus:border-transparent transition text-spac-dark"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {/* Recordar sesión */}
          {/*
          <div className="flex items-center">
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-spac-orange bg-gray-100 border-gray-300 rounded focus:ring-spac-orange focus:ring-2"
              disabled={loading}
            />
            <label 
              htmlFor="remember" 
              className="ml-2 text-sm text-spac-dark-secondary cursor-pointer"
            >
              Recordar mi sesión
            </label>
          </div>
          */}

          {/* Botón de login */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-spac-orange hover:bg-spac-orange-dark text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Divisor */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-spac-gray">
              Acceso para personal autorizado
            </span>
          </div>
        </div>

        {/* Link para seguimiento de clientes */}
        <div className="text-center">
          <p className="text-sm text-spac-dark-secondary mb-2">
            ¿Eres cliente?
          </p>
          <button
            type="button"
            onClick={() => navigate('/seguimiento')}
            className="text-spac-orange hover:text-spac-orange-dark font-semibold text-sm transition inline-flex items-center gap-1"
          >
            Rastrear mi pedido
            <span className="text-lg">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};