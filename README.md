# 🏪 Sistema de Inventario POS

Sistema de gestión de inventario moderno y completo para bodegas y puntos de venta, construido con React, Firebase y Tailwind CSS.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react)
![Firebase](https://img.shields.io/badge/Firebase-12.7.0-FFCA28?logo=firebase)
![Tailwind](https://img.shields.io/badge/Tailwind-4.1.18-38B2AC?logo=tailwind-css)

## ✨ Características Principales

### 🎨 Interfaz Moderna
- **Modo Oscuro/Claro**: Tema adaptable con transiciones suaves
- **Diseño Premium**: Interfaz glassmorphism con animaciones fluidas
- **Responsive**: Optimizado para desktop y móvil
- **Accesibilidad**: Componentes accesibles y navegación intuitiva

### 📦 Gestión de Inventario
- Control de stock en tiempo real
- Múltiples bodegas/sucursales
- Búsqueda y filtrado avanzado
- Códigos de barras
- Alertas de stock bajo

### 💰 Punto de Venta (POS)
- Interfaz rápida y eficiente
- Múltiples métodos de pago (Efectivo, Transferencia, Pago Móvil)
- Cálculo automático de cambio
- Soporte para USD y Bs
- Historial de transacciones

### 📊 Reportes y Analytics
- Ventas diarias/mensuales
- Filtrado por fecha y bodega
- Exportación a PDF y Excel
- Métricas de rendimiento
- Dashboard con KPIs

### 👥 Gestión de Usuarios
- Roles: Administrador y Empleado
- Permisos granulares
- Asignación de bodegas
- Protección del admin principal
- Autenticación segura con Firebase

### 💳 Gestión de Deudores
- Registro de créditos
- Seguimiento de pagos
- Alertas de morosidad
- Historial completo

## 🚀 Tecnologías

- **Frontend**: React 19.2 + Vite
- **Estilos**: Tailwind CSS 4.1 (CSS-first)
- **Animaciones**: Framer Motion
- **Base de Datos**: Firebase Firestore
- **Autenticación**: Firebase Auth
- **Iconos**: Lucide React
- **Exportación**: jsPDF + jsPDF-AutoTable
- **Routing**: React Router DOM 7

## 📋 Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Cuenta de Firebase

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/inventario-pos.git
cd inventario-pos
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar Firebase**

Crea un archivo `src/firebase.js` con tu configuración:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
```

4. **Iniciar el servidor de desarrollo**
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 🏗️ Estructura del Proyecto

```
inventario-pos/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── Layout.jsx       # Layout principal con sidebar
│   │   ├── ProductModal.jsx # Modal de productos
│   │   └── PaymentModal.jsx # Modal de pagos
│   ├── contexts/            # Context API
│   │   ├── AuthContext.jsx  # Autenticación
│   │   ├── ThemeContext.jsx # Tema claro/oscuro
│   │   └── ToastContext.jsx # Notificaciones
│   ├── hooks/               # Custom hooks
│   │   └── useSystemConfig.jsx
│   ├── pages/               # Páginas principales
│   │   ├── Dashboard.jsx    # Panel principal
│   │   ├── POS.jsx          # Punto de venta
│   │   ├── Inventory.jsx    # Gestión de inventario
│   │   ├── Reports.jsx      # Reportes
│   │   ├── Debtors.jsx      # Deudores
│   │   ├── Settings.jsx     # Configuración
│   │   └── Login.jsx        # Inicio de sesión
│   ├── firebase.js          # Configuración Firebase
│   ├── index.css            # Estilos globales
│   ├── App.jsx              # Componente raíz
│   └── main.jsx             # Punto de entrada
├── public/                  # Archivos estáticos
├── tailwind.config.js       # Configuración Tailwind
├── vite.config.js           # Configuración Vite
└── package.json
```

## 🎯 Uso

### Primer Inicio

1. **Crear Admin Principal**
   - Regístrate con el email que será el administrador principal
   - Este usuario no podrá ser eliminado

2. **Configurar Bodegas**
   - Ve a Configuración → Gestionar Bodegas
   - Crea tu primera bodega/sucursal

3. **Configurar Tasa de Cambio**
   - En Configuración → Tasa de Cambio
   - Establece la tasa USD/Bs actual

4. **Crear Usuarios**
   - Registra empleados y asígnalos a bodegas
   - Define roles (Empleado/Administrador)

5. **Agregar Productos**
   - Ve a Inventario → Nuevo Item
   - Ingresa nombre, precio, código de barras y stock inicial

### Flujo de Venta

1. Ir a **Registrar Ventas**
2. Buscar productos por nombre o código
3. Agregar al carrito
4. Procesar pago
5. Seleccionar método de pago y monto
6. Confirmar venta

## 🎨 Personalización

### Colores del Tema

Edita `src/index.css` para cambiar la paleta de colores:

```css
@theme {
  --color-primary-500: #8B5CF6;  /* Color principal */
  --color-primary-600: #7C3AED;  /* Hover */
  /* ... más colores */
}
```

### Modo Oscuro

El modo oscuro usa la variante `dark:` de Tailwind CSS v4:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

## 📱 Características Avanzadas

- **Offline-First**: Caché local con Firestore
- **Real-time Updates**: Sincronización en tiempo real
- **Multi-Currency**: Soporte USD y Bs
- **Export**: PDF y Excel para reportes
- **Toast Notifications**: Sistema de notificaciones elegante
- **Protected Routes**: Rutas protegidas por rol

## 🔒 Seguridad

- Autenticación Firebase
- Reglas de seguridad Firestore
- Validación de roles
- Protección contra eliminación del admin principal
- Sesiones seguras

## 🐛 Problemas Conocidos

Consulta la sección [Issues](https://github.com/tu-usuario/inventario-pos/issues) para reportar bugs o solicitar features.

## 📄 Licencia

Este proyecto es de código abierto bajo la licencia MIT.

## 👨‍💻 Autor

Desarrollado con ❤️ para la gestión eficiente de inventarios.

## 🙏 Agradecimientos

- [React](https://react.dev/)
- [Firebase](https://firebase.google.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [Framer Motion](https://www.framer.com/motion/)

---

⭐ Si este proyecto te fue útil, considera darle una estrella en GitHub!
