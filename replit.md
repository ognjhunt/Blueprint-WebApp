# Blueprint Robotics Platform

## Overview

Blueprint is a comprehensive robotics data and AI platform that provides spatial context and digital twins for autonomous systems. The platform combines React frontend with Express.js backend, providing tools for space mapping, environmental context delivery, AI-powered robot interactions, and analytics.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **State Management**: React hooks with context providers
- **Routing**: Wouter for client-side routing
- **3D Rendering**: Three.js for 3D model visualization and spatial context

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Build Process**: esbuild for server bundling, Vite for client bundling
- **Development**: Hot module replacement in development, tsx for server watching

### Authentication & External Services
- **Authentication**: Firebase Auth with Google OAuth integration
- **File Storage**: Firebase Storage for blueprints, 3D models, and assets
- **AI Services**: 
  - Google Gemini for floor plan analysis and content generation
  - Anthropic Claude integration
  - OpenAI compatibility layer
- **Payments**: Stripe integration for subscription management
- **Maps**: Google Maps API for location services

## Key Components

### Scene Management
- Interactive floor plan and 3D space editor with grid-based layout
- Spatial data representation and context mapping
- Real-time 3D model preview and manipulation
- Multi-layer content management (annotations, sensor data, models)
- Scene graph management for robot navigation

### Robot Context Engine
- Digital twin creation and maintenance
- Real-time spatial context delivery
- 3D model loading and positioning
- Environmental constraint and rule encoding
- Robot-specific data serving and management

### AI Integration Layer
- Automated floor plan analysis using Gemini Vision
- Dynamic spatial context generation
- Robot path planning optimization
- Natural language processing for robot instructions

### Authentication System
- Firebase-based user management
- Role-based access control (business owners, team members)
- OAuth integration with Google
- Team invitation and management system

## Data Flow

1. **Site Onboarding**: Clients upload floor plans → Gemini analyzes layout → System creates digital twin with spatial markers
2. **Scene Configuration**: Operators place spatial data elements → System generates scene graph coordinates → Context is stored with positional metadata
3. **Robot Arrival**: Robot authenticates with platform → Downloads digital twin data → Robot receives spatial context and navigation constraints
4. **Analytics Flow**: Robot telemetry captured → Data processed for insights → Platform dashboard updated with deployment metrics

## External Dependencies

### Core Services
- **Firebase**: Authentication, file storage, real-time database
- **Google Cloud AI**: Gemini models for content analysis and generation
- **Stripe**: Payment processing and subscription management
- **Google Maps**: Location services and business verification

### Development Tools
- **Drizzle ORM**: Database schema management and migrations
- **Replit**: Development environment and deployment platform
- **GitHub**: Version control and code collaboration

### UI/UX Libraries
- **Radix UI**: Accessible component primitives
- **Heroicons**: Icon library
- **React Hook Form**: Form validation and management
- **Framer Motion**: Animation and transitions

## Deployment Strategy

The application uses a custom deployment approach due to build tool compatibility issues:

### Build Process
1. **Client Build**: Vite compiles React app to static assets
2. **Server Build**: esbuild bundles Express server with TypeScript support
3. **Asset Management**: Firebase handles file uploads and CDN distribution

### Deployment Methods
1. **Automated**: `npm run build` handles both client and server compilation
2. **Manual Deployment**: Multiple deployment scripts handle edge cases with build flags
3. **Production Serving**: Express serves static files in production, Vite dev server in development

### Environment Configuration
- Development: Hot reload with Vite middleware
- Production: Static file serving with Express
- Database: PostgreSQL with connection pooling via Drizzle ORM

## Changelog
- Jan 14, 2025: Fixed TypeScript build errors in Help.tsx for successful deployment
  - Removed incompatible Next.js metadata export causing Fast Refresh issues in React+Wouter setup
  - Fixed type mismatch between Tabs component onValueChange and state setter function
  - Added proper type-safe wrapper function for handling string to union type conversion
  - Resolved all TypeScript compilation errors preventing build completion
- Jan 7, 2025: Fixed TypeScript compilation errors in ContactForm.tsx
  - Added proper TypeScript interfaces for form data and Google Maps API types
  - Fixed state management types for autocomplete predictions and services
  - Added proper error handling with type-safe error messages
  - Updated tsconfig.json to include Google Maps types
  - Resolved all TypeScript compilation errors preventing deployment
- June 29, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.