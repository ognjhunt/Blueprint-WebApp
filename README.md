# Blueprint

## Introduction
Blueprint is an Augmented Reality (AR) experience platform designed for businesses. Its primary purpose is to empower businesses to create engaging and interactive AR experiences for their customers, enhance operational efficiency, and gain valuable insights into customer behavior.

## Features
-   **AR Experience Creation:** Tools for businesses to design and build custom AR scenarios.
-   **3D Model Integration:** Supports uploading and displaying 3D models within AR experiences.
-   **Floor Plan Visualization:** Allows for the creation and use of digital floor plans as a basis for AR content.
-   **QR Code Generation & Scanning:** Easy generation of QR codes for users to launch AR experiences and tools for scanning these codes.
-   **AI-Powered Chat Assistant:** Integration with Google Gemini for AI-driven interactions.
-   **User Authentication:** Secure sign-up and sign-in functionalities for businesses and potentially end-users (Firebase Auth, Passport.js).
-   **Business Dashboard & Workspace:** A dedicated area for businesses to manage their blueprints, settings, and collaborative projects.
-   **Team Management:** Features for inviting and managing team members.
-   **Payments and Subscriptions:** Integration with Stripe for managing plans and billing.
-   **Customer Experience Designer:** Tools to tailor and refine the end-user AR journey.
-   **Real-time Location & Mapping Features:** Utilizes Google Maps for location-based AR experiences.
-   **Workflow Hub:** A system for managing and potentially automating AR experience workflows.

## Tech Stack

**Frontend:**
-   React
-   Vite
-   TypeScript
-   Tailwind CSS
-   shadcn/ui (UI Components)
-   Zustand (State Management)
-   Three.js (3D Graphics)
-   Framer Motion (Animations)
-   React Query (Data Fetching)
-   Wouter (Routing)

**Backend:**
-   Node.js
-   Express.js

**Database:**
-   Drizzle ORM

**Authentication:**
-   Firebase Authentication
-   Passport.js

**APIs & Services:**
-   Google Generative AI (Gemini)
-   Google Maps API
-   Stripe API
-   Luma AI API
-   Firebase (Storage, Firestore, etc.)

## Project Structure
The project is organized into the following main directories:
-   `client/`: Contains the React frontend application, including components, pages, hooks, contexts, and static assets.
-   `server/`: Contains the Node.js/Express backend application, including API routes and server configuration.
-   `db/`: Contains database schema definitions and Drizzle ORM configuration.

## Getting Started

To get the Blueprint application running locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install dependencies:**
    This project uses npm.
    ```bash
    npm install 
    # This should install dependencies for both server and client,
    # as they are managed in the root package.json.
    ```
3.  **Set up Environment Variables:**
    You will need to configure environment variables for various services such as Firebase, Google Cloud (for Gemini and Maps), Stripe, and Luma AI. These would typically be in a `.env` file in the `server` directory and potentially in the `client` directory (prefixed with `VITE_` for Vite projects). Refer to the specific service documentation for the required keys.
4.  **Initialize Database:**
    If a database setup is required (e.g., creating tables based on the Drizzle schema), ensure your database server is running and execute any necessary migration commands.
    ```bash
    # For Drizzle ORM, you can push schema changes using:
    npm run db:push 
    # Ensure your database connection string is correctly configured in your environment variables.
    ```
5.  **Run the development server:**
    This command typically starts both the backend and frontend development servers.
    ```bash
    npm run dev
    ```
    The application should then be accessible at the local development URL (often `http://localhost:5173` for Vite frontend and `http://localhost:5000` for the backend).

## Usage
Blueprint is designed for businesses to create, manage, and deploy AR experiences.
-   **Businesses:** Sign up, create or claim their business profile, design AR experiences using the editor, manage workspaces, and view analytics.
-   **End-Users (Customers of Businesses):** Interact with these AR experiences at business locations, typically by scanning a QR code or through a dedicated mobile interface (details depend on the specific implementation).

## Deployment
The project is built using `npm run build`. This command bundles the frontend and backend for production.

**Important:** There is a known issue with the default esbuild flag in `package.json` that can affect deployments. Please refer to `DEPLOYMENT.md` for detailed instructions and workarounds.

## Contributing
Contributions are welcome! Please feel free to open an issue to discuss a bug or feature, or submit a pull request with your changes.

## License
This project is licensed under the MIT License. See the `package.json` for more details. (Ideally, a `LICENSE` file would be present in the repository).
