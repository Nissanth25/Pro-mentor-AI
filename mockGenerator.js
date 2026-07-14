// ═══════════════════════════════════════════════════════════════
//  ProMentor AI — mockGenerator.js
//  High-fidelity domain-specific fallback documentation generator
// ═══════════════════════════════════════════════════════════════

export function generateMockData(w) {
  const domain = w.domain || 'Web Application';
  const title = w.title || 'Smart Project System';
  const abstract = w.abstract || 'A project details description.';
  const timeline = w.timeline || '3 months';
  const team = w.team || '4-6 developers';
  const type = w.type || 'Academic';

  // Base Tech presets
  const presets = {
    'AI / Machine Learning': {
      languages: [
        { name: 'Python', purpose: 'Core language for ML model training, scripting, and preprocessing pipelines.', icon: '🐍' },
        { name: 'JavaScript', purpose: 'Client-side web interactivity and asynchronous API calls.', icon: '🌐' }
      ],
      frameworks: [
        { name: 'FastAPI', purpose: 'High-performance backend API service to expose ML models.', icon: '⚡' },
        { name: 'PyTorch / TensorFlow', purpose: 'Deep learning framework for building, training, and running model inference.', icon: '🔥' },
        { name: 'React.js', purpose: 'Interactive frontend user interface for user interactions.', icon: '⚛️' }
      ],
      databases: [
        { name: 'PostgreSQL', purpose: 'Relational database for structured user accounts and metadata.', icon: '🐘' },
        { name: 'Qdrant / Milvus', purpose: 'Vector database for high-performance retrieval and vector embeddings.', icon: '🔍' }
      ],
      apis: [
        { name: 'Hugging Face API', purpose: 'Accessing state-of-the-art pretrained transformer models.', icon: '🤗' }
      ],
      aiml: [
        { name: 'Scikit-Learn', purpose: 'Classic machine learning algorithms, data splitting, and evaluation.', icon: '📊' },
        { name: 'Pandas & NumPy', purpose: 'Data structures, manipulation, cleaning, and mathematical operations.', icon: '🐼' }
      ],
      devtools: [
        { name: 'Jupyter Notebook', purpose: 'Exploratory data analysis, prototyping models, and visualization.', icon: '📓' }
      ],
      deployment: [
        { name: 'Docker', purpose: 'Containerizing the application and model server for consistency.', icon: '🐳' },
        { name: 'AWS EC2 / GCP', purpose: 'Hosting the model server with GPU capabilities.', icon: '☁️' }
      ],
      testing: [
        { name: 'PyTest', purpose: 'Writing assertions for data validation and API response correctness.', icon: '🧪' }
      ],
      diagrams: {
        useCase: `flowchart TD
  User([User]) --> UC1(Upload Data)
  User --> UC2(Run ML Inference)
  User --> UC3(View Analysis)
  Admin([Admin]) --> UC4(Monitor Models)`,
        classDiagram: `classDiagram
  class ModelManager {
    +modelId: String
    +status: String
    +train(dataset)
    +predict(inputData)
  }
  class DataPreprocessor {
    +clean(raw)
    +vectorize(tokens)
  }`,
        sequenceDiagram: `sequenceDiagram
  participant U as User
  participant UI as Web UI
  participant API as FastAPI Server
  participant ML as ML Worker
  U->>UI: Submit raw input
  UI->>API: POST /api/v1/predict
  API->>ML: Pass structured parameters
  ML-->>API: Return classification probabilities
  API-->>UI: Send response JSON
  UI-->>U: Render prediction results`,
        erDiagram: `erDiagram
  USER ||--o{ PROJECT : owns
  PROJECT ||--o{ MODEL_METRIC : tracks
  PROJECT ||--o{ DATASET : utilizes`,
        systemArchitecture: `flowchart TB
  UI[React UI] --> API[FastAPI Gateway]
  API --> Queue[Redis Queue]
  Queue --> ML[PyTorch Model Inference Node]
  ML --> DB[(PostgreSQL + Vector DB)]`,
        dataFlow: `flowchart LR
  Raw[Raw Input Data] --> Prep[Preprocessing & Vectorization] --> Model[Inference Engine] --> Post[Threshold Analysis] --> Output[Final Results]`
      }
    },
    'Web Application': {
      languages: [
        { name: 'JavaScript / TypeScript', purpose: 'Main programming language for client and server code.', icon: '🌐' }
      ],
      frameworks: [
        { name: 'React.js', purpose: 'Frontend architecture with responsive components.', icon: '⚛️' },
        { name: 'Node.js & Express.js', purpose: 'Backend REST API routing and request handling.', icon: '🟢' }
      ],
      databases: [
        { name: 'MongoDB', purpose: 'NoSQL document database for flexible schemas.', icon: '🍃' }
      ],
      apis: [
        { name: 'SendGrid API', purpose: 'Transactional emails and notification deliveries.', icon: '📧' }
      ],
      aiml: [
        { name: 'TensorFlow.js', purpose: 'Client-side light search-autocomplete and suggestions.', icon: '🧠' }
      ],
      devtools: [
        { name: 'VS Code', purpose: 'Primary IDE for writing and formatting codebase.', icon: '💻' }
      ],
      deployment: [
        { name: 'Vercel / Heroku', purpose: 'Automated hosting and CI/CD pipelines.', icon: '▲' }
      ],
      testing: [
        { name: 'Jest', purpose: 'Writing unit and integration tests for route handlers.', icon: '🧪' }
      ],
      diagrams: {
        useCase: `flowchart TD
  User([User]) --> UC1(Log In)
  User --> UC2(Create Project Workspace)
  User --> UC3(Export Report)
  Admin([Admin]) --> UC4(Manage System Settings)`,
        classDiagram: `classDiagram
  class Project {
    +projectId: String
    +title: String
    +abstract: String
    +createdAt: Date
    +save()
  }
  class User {
    +userId: String
    +name: String
    +email: String
    +projects: Array
    +register()
  }
  User "1" --> "*" Project : creates`,
        sequenceDiagram: `sequenceDiagram
  participant U as User
  participant UI as React Frontend
  participant API as Express API Server
  participant DB as MongoDB
  U->>UI: Click "Create Project"
  UI->>API: POST /api/projects {title, abstract}
  API->>DB: Insert new document
  DB-->>API: Return inserted metadata
  API-->>UI: Return project object
  UI-->>U: Render success notification`,
        erDiagram: `erDiagram
  USER ||--o{ PROJECT : creates
  PROJECT ||--o{ MODULE : contains
  MODULE ||--o{ TASK : includes`,
        systemArchitecture: `flowchart TB
  Client[Web Browser Client] --> Gateway[Express API Gateway]
  Gateway --> Services[Domain Services]
  Services --> MongoDB[(MongoDB Database)]`,
        dataFlow: `flowchart LR
  Form[Form Submit] --> Validate[JSON Validation] --> DBWrite[DB Persistence] --> Toast[UI Notification]`
      }
    }
  };

  // Select preset or default to Web App
  const activePreset = presets[domain] || presets['Web Application'];

  // Dynamically tailor text based on Title and Domain
  return {
    overview: {
      tagline: `An intelligent platform for automated ${domain} project assistance.`,
      problemStatement: `Developing a software system in the ${domain} domain often involves complex architectural decisions, requirements modeling, and technology selection. Teams struggle to align on a single blueprint, leading to scope creep and development delays. "${title}" addresses this gap.`,
      objectives: [
        `Design and implement a responsive user interface for managing project data.`,
        `Integrate domain-aware modules to streamline core business operations.`,
        `Automate documentation generation including SRS outlines and structural diagrams.`,
        `Provide collaborative channels for developer coordination and milestone tracking.`,
        `Ensure system robustness through automated testing and continuous integration.`,
        `Deploy the application to secure, scalable hosting environments.`
      ],
      scope: `The system covers workspace setup, database modeling, basic CRUD actions, and documentation exports. Third-party messaging systems and high-end payment gateways are currently excluded.`,
      targetUsers: [
        `Software Developers looking for a template starter kit.`,
        `Project Managers seeking automated requirements tracking.`,
        `Academic Students building their core final-year projects.`,
        `System Architects looking to validate technology combinations.`
      ],
      expectedOutcomes: [
        `Reduced setup time from days to minutes.`,
        `Consistent, standardized folder structure for source code.`,
        `Auto-rendered Mermaid.js diagrams for easy visual system reviews.`,
        `Fewer requirements misunderstandings due to structured SRS templates.`,
        `Immediate project readiness with fully detailed test cases.`
      ],
      modules: [
        {
          name: "Authentication & User Management",
          description: "Manages safe user signup, password hashing, and session management.",
          features: ["Secure registration", "Login/Logout", "Profile settings"]
        },
        {
          name: "Project Core Engine",
          description: "The central workspace for CRUD operations and editing details.",
          features: ["Workspace creation", "Data editing", "Automatic auto-save"]
        },
        {
          name: "Diagram Rendering Module",
          description: "Generates visual flowcharts and UML constructs dynamically.",
          features: ["Mermaid syntax compiler", "Diagram zoom/pan", "SVG export options"]
        },
        {
          name: "Documentation Compiler",
          description: "Gathers all project aspects into a formatted download file.",
          features: ["HTML preview", "Copy-to-clipboard", "Browser print to PDF"]
        }
      ]
    },
    techStack: activePreset,
    srs: {
      introduction: `This Software Requirements Specification (SRS) details the specifications for "${title}". It describes functional, non-functional, and environment constraints.`,
      purpose: `The purpose is to establish a solid roadmap for implementation.`,
      scope: `This covers frontend rendering, backend services, and database persistence.`,
      definitions: {
        "SRS": "Software Requirements Specification",
        "API": "Application Programming Interface",
        "NoSQL": "Non-relational database management system",
        "UI/UX": "User Interface / User Experience"
      },
      functionalRequirements: [
        { id: "FR-001", title: "User Signup", description: "The system shall allow users to register with a valid email and strong password.", priority: "High" },
        { id: "FR-002", title: "Project Creation", description: "Verified users shall be able to create new project spaces with a title and description.", priority: "High" },
        { id: "FR-003", title: "Mermaid Rendering", description: "The system shall compile Mermaid text strings into visible SVG diagrams dynamically.", priority: "Medium" },
        { id: "FR-004", title: "PDF Export", description: "Users shall be able to trigger browser printing to export the complete report.", priority: "Medium" }
      ],
      nonFunctionalRequirements: [
        { id: "NFR-001", title: "Response Latency", description: "The UI page loading and API updates must complete within 2 seconds.", category: "Performance" },
        { id: "NFR-002", title: "Responsive Layout", description: "The interface must adapt to mobile, tablet, and widescreen layouts.", category: "Usability" },
        { id: "NFR-003", title: "Storage Encryption", description: "All passwords stored in the database must use modern hashing schemes.", category: "Security" }
      ],
      systemConstraints: [
        "Must run entirely client-side for storage constraints.",
        "Requires standard modern browser environments (Chrome, Safari, Firefox)."
      ],
      assumptions: [
        "Users have persistent internet access during diagram generation.",
        "Browser permissions allow local storage operations."
      ],
      dependencies: [
        "Mermaid.js library loaded via CDN.",
        "Google Fonts API for Outfit typography."
      ]
    },
    diagrams: activePreset.diagrams,
    codeStructure: {
      architecturePattern: "Model-View-Controller (MVC) or Component-Based Structure",
      folderTree: `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   └── TabView.jsx
│   ├── services/
│   │   └── api.js
│   ├── styles/
│   │   └── main.css
│   └── app.js
└── package.json`,
      keyFiles: [
        { path: "src/app.js", purpose: "The core entrance file initializing routes and UI states." },
        { path: "src/services/api.js", purpose: "API request module managing interactions with external endpoints." }
      ],
      apiEndpoints: [
        { method: "GET", endpoint: "/api/projects", description: "Returns list of active user workspaces." },
        { method: "POST", endpoint: "/api/projects", description: "Creates a new project item in database." }
      ]
    },
    testCases: [
      {
        module: "Authentication Module",
        cases: [
          { id: "TC-001", title: "Successful Register", input: "Valid email, matching passwords", expected: "Account created successfully.", type: "Unit" },
          { id: "TC-002", title: "Invalid Login", input: "Unregistered email or wrong password", expected: "Error message displayed.", type: "Unit" }
        ]
      },
      {
        module: "Project Manager Module",
        cases: [
          { id: "TC-003", title: "Create Space", input: "Title: 'Test App', Domain: 'Healthcare'", expected: "Workspace loaded with blank modules.", type: "Integration" }
        ]
      }
    ],
    featureSuggestions: [
      { id: "FS-001", title: "AI-Powered Chat Assistant", description: "Expose an interactive LLM chat component to answer technical questions.", type: "AI Integration", impact: "High", effort: "Medium", icon: "🤖" },
      { id: "FS-002", title: "Multi-Cloud Hosting Pipeline", description: "Integrate continuous delivery actions targeting AWS and Vercel environments.", type: "Cloud Services", impact: "Medium", effort: "Medium", icon: "☁️" },
      { id: "FS-003", title: "Two-Factor Auth Support", description: "Allow users to protect accounts using dynamic OTP authentication tools.", type: "Security", impact: "High", effort: "Low", icon: "🔒" }
    ],
    slides: [
      { slideNumber: 1, title: title, content: [`Domain: ${domain}`, "Project Presentation Plan", "Generated by ProMentor AI"], notes: "Welcome everyone to the project presentation." },
      { slideNumber: 2, title: "Problem Statement", content: [`Challenges in establishing core ${domain} components.`, "Scope management issues.", "Technical roadmap misalignments."], notes: "Here we outline why we are building this platform." },
      { slideNumber: 3, title: "System Objectives", content: ["Streamlined project scaffolding.", "Auto-generated schemas and documentation.", "Frictionless setup routines."], notes: "These are our core metrics." },
      { slideNumber: 4, title: "Technology Selection", content: [`Primary Languages: ${activePreset.languages.map(l=>l.name).join(', ')}`, "Database: NoSQL/SQL structures", "Scalable cloud services"], notes: "We chose these frameworks for productivity." },
      { slideNumber: 5, title: "Demo & Walkthrough", content: ["Live component interactions.", "Dynamic Mermaid compiler.", "Tabbed document exporter."], notes: "Let's review the active workspace interface." },
      { slideNumber: 6, title: "Future Scope", content: ["Enhanced AI code suggestions.", "Live collaboration panels.", "Offline desktop applications."], notes: "This is where we plan to head next." }
    ],
    vivaQuestions: [
      { question: "What is the core problem this project solves?", answer: `This project targets inefficiencies in software blueprinting within the ${domain} domain by automating SRS document creation and database scaffolding.`, category: "General" },
      { question: "Why did you choose this specific tech stack?", answer: "The chosen technologies provide an optimal balance of rendering speed, data storage flexibility, and ease of deployment.", category: "Technical" },
      { question: "How are diagrams generated inside the app?", answer: "We use Mermaid.js, which takes text-based flowchart specifications and compiles them client-side into vector-based SVG graphics.", category: "Architecture" }
    ]
  };
}

export function generateLocalChatResponse(userMsg, proj) {
  const msg = userMsg.toLowerCase();
  const title = proj ? proj.title : "your project";
  const domain = proj ? proj.domain : "software development";

  if (msg.includes('start') || msg.includes('how to build') || msg.includes('step')) {
    return `To begin development on **${title}**, I recommend this roadmap:
1. **Scaffold Folder Structure:** Setup your repo matching the tree under the **Code** tab.
2. **Database Schema:** Set up your database tables using the **Diagrams → ER Diagram** as a blueprint.
3. **Core API Routes:** Build authentication endpoints, followed by user workspace creation routes.
4. **Scaffold Frontend Layout:** Install React (or your chosen framework) and build dashboard shells.`;
  }
  if (msg.includes('best practice') || msg.includes('standard')) {
    return `Here are the top development best practices for a **${domain}** project:
- **Clean Architecture:** Keep business logic separated from database schema files.
- **Strict Linting:** Use ESLint and Prettier to keep styling consistent.
- **Secure Credentials:** Never commit API keys or Firebase tokens. Load them using environmental variables (.env).
- **Comprehensive Unit Testing:** Add testing suites covering validation code and router outputs.`;
  }
  if (msg.includes('architecture') || msg.includes('pattern') || msg.includes('design')) {
    return `For **${title}**, we recommend a structured **Model-View-Controller (MVC)** or component-focused service structure.
- **Model:** Represents database collections/tables (e.g., User, Workspace).
- **Controller/Service:** Contains validation, database querying, and API business rules.
- **View/Client:** Handles presentation layout using reactive page templates.`;
  }

  return `Great question! Regarding **${title}** (which focuses on the **${domain}** space), we should structure development carefully. 

Could you clarify if you are asking about the database structure, frontend components, or setting up API routes? I'm ready to explain any technical aspect of your project blueprint!`;
}
