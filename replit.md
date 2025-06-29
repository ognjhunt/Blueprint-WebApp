# Blueprint AR Platform

## Overview

Blueprint is a comprehensive AR (Augmented Reality) and AI platform that enables businesses to create immersive, interactive experiences for their physical spaces. The platform combines React frontend with Express.js backend, providing tools for space mapping, AR element placement, AI-powered customer interactions, and analytics.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **State Management**: React hooks with context providers
- **Routing**: Wouter for client-side routing
- **3D Rendering**: Three.js for 3D model visualization and AR experiences

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

### Blueprint Editor
- Interactive floor plan editor with grid-based layout
- Drag-and-drop AR element placement
- Real-time 3D model preview and manipulation
- Multi-layer content management (annotations, links, models)
- Collaborative editing capabilities

### AR Experience Engine
- QR code-based space entry
- 3D model loading and positioning
- Interactive anchor points and hotspots
- Real-time user interaction tracking
- Cross-platform AR compatibility

### AI Integration Layer
- Automated floor plan analysis using Gemini Vision
- Dynamic content generation for space descriptions
- Personalized user recommendations
- Natural language processing for customer interactions

### Authentication System
- Firebase-based user management
- Role-based access control (business owners, team members)
- OAuth integration with Google
- Team invitation and management system

## Data Flow

1. **Business Onboarding**: Users upload floor plans → Gemini analyzes layout → AI suggests optimal AR placement zones
2. **Content Creation**: Business owners place AR elements → System generates spatial coordinates → Content is stored with positional metadata
3. **User Experience**: Visitors scan QR codes → App loads space data → AR elements render based on device position
4. **Analytics Flow**: User interactions captured → Data processed for insights → Business dashboard updated with engagement metrics

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
- June 29, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.