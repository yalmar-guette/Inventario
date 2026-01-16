# 🏪 Sistema de Gestión de Inventario POS

Sistema moderno de gestión de inventario y punto de venta para bodegas y comercios, construido con React, Supabase y Tailwind CSS.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-2.90.1-3ECF8E?logo=supabase)
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
- **Validación de productos únicos** (sin duplicados por nombre)

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
- Roles: Administrador (OWNER) y Empleado (EMPLOYEE)
- Permisos granulares con Row Level Security
- Asignación de bodegas por usuario
- Protección del admin principal
- Autenticación segura con Supabase

### 💳 Gestión de Deudores
- Registro de créditos
- Seguimiento de pagos
- Alertas de morosidad
- Historial completo

## 🚀 Tecnologías

- **Frontend**: React 19.2 + Vite
- **Estilos**: Tailwind CSS 4.1 (CSS-first)
- **Animaciones**: Framer Motion
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Iconos**: Lucide React
- **Exportación**: jsPDF + jsPDF-AutoTable
- **Routing**: React Router DOM 7

## 📋 Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Cuenta de Supabase ([supabase.com](https://supabase.com))

## 🛠️ Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/inventario-pos.git
cd inventario-pos
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Supabase

Crea un archivo `.env` en la raíz del proyecto con tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

> **Nota:** Puedes obtener estas credenciales desde tu proyecto en [Supabase Dashboard](https://app.supabase.com) → Settings → API.

### 4. Configurar la Base de Datos

Ejecuta el script SQL del esquema en tu proyecto de Supabase:

1. Abre tu proyecto en Supabase Dashboard
2. Ve a SQL Editor
3. Copia el contenido de `supabase-schema.sql`
4. Ejecuta el script

Esto creará todas las tablas necesarias, políticas RLS y funciones.

### 5. Iniciar el servidor de desarrollo

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
│   ├── supabase.js          # Configuración Supabase
│   ├── index.css            # Estilos globales
│   ├── App.jsx              # Componente raíz
│   └── main.jsx             # Punto de entrada
├── public/                  # Archivos estáticos
├── supabase-schema.sql      # Esquema de base de datos
├── tailwind.config.js       # Configuración Tailwind
├── vite.config.js           # Configuración Vite
└── package.json
```

## 🎯 Uso

### Primer Inicio

1. **Crear Admin Principal**
   - Regístrate con el email que será el administrador principal
   - Este usuario tendrá rol OWNER y no podrá ser eliminado

2. **Configurar Bodegas**
   - Ve a Configuración → Gestionar Bodegas
   - Crea tu primera bodega/sucursal

3. **Configurar Tasa de Cambio**
   - En Configuración → Tasa de Cambio
   - Establece la tasa USD/Bs actual

4. **Crear Usuarios**
   - Registra empleados y asígnalos a bodegas
   - Define roles (EMPLOYEE/OWNER)

5. **Agregar Productos**
   - Ve a Inventario → Nuevo Item
   - Ingresa nombre, precio, código de barras y stock inicial
   - El sistema validará que no existan productos duplicados

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

- **Real-time Updates**: Suscripciones en tiempo real con Supabase Realtime
- **Row Level Security**: Políticas RLS en PostgreSQL para seguridad granular
- **Multi-Currency**: Soporte USD y Bs
- **Export**: PDF y Excel para reportes
- **Toast Notifications**: Sistema de notificaciones elegante
- **Protected Routes**: Rutas protegidas por rol y autenticación

## 🔒 Seguridad

- **Autenticación Supabase**: Sistema seguro de autenticación con JWT
- **Row Level Security (RLS)**: Políticas a nivel de fila en PostgreSQL
- **Validación de Roles**: Control de acceso basado en roles (RBAC)
- **Protección de Admin**: El usuario admin principal no puede ser eliminado
- **Validación de Datos**: Constraints y validaciones a nivel de base de datos

## 📊 Base de Datos

El proyecto usa PostgreSQL a través de Supabase con las siguientes tablas principales:

- `users` - Usuarios del sistema
- `bodegas` - Bodegas/sucursales
- `products` - Inventario de productos
- `sales` - Registro de ventas
- `debtors` - Gestión de créditos
- `system_config` - Configuración general

Todas las tablas tienen políticas RLS configuradas para máxima seguridad.

## 🐛 Problemas Conocidos

Consulta la sección [Issues](https://github.com/tu-usuario/inventario-pos/issues) para reportar bugs o solicitar features.

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código abierto bajo la licencia MIT.

## 👨‍💻 Autor

Desarrollado con ❤️ para la gestión eficiente de inventarios.

## 🙏 Agradecimientos

- [React](https://react.dev/) - Framework UI
- [Supabase](https://supabase.com/) - Backend as a Service
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS
- [Lucide Icons](https://lucide.dev/) - Iconos
- [Framer Motion](https://www.framer.com/motion/) - Animaciones

---

⭐ Si este proyecto te fue útil, considera darle una estrella en GitHub!
