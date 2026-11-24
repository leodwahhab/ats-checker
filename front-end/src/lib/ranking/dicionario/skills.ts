import type { SkillCategoria, SkillDef } from '../types';

type Extra = Pick<SkillDef, 'implica' | 'relacionadas' | 'regex' | 'conceito'>;
type Linha = [id: string, rotulo: string, aliases?: string[], extra?: Extra];

function grupo(categoria: SkillCategoria, linhas: Linha[]): SkillDef[] {
  return linhas.map(([id, rotulo, aliases = [], extra = {}]) => ({ id, rotulo, categoria, aliases, ...extra }));
}

// Limites de palavra dos padrões próprios. Rodam sobre o texto original, sensíveis a maiúsculas.
const A = '(?<![\\p{L}\\p{N}_])';
const D = '(?![\\p{L}\\p{N}_])';

const RELACIONAIS = ['postgresql', 'mysql', 'mariadb', 'sql-server', 'oracle', 'db2'];
const NUVENS = ['aws', 'azure', 'gcp'];
const CI = ['jenkins', 'github-actions', 'gitlab-ci', 'azure-devops', 'circleci', 'bitbucket-pipelines'];
const outros = (id: string, ids: string[]) => ids.filter((x) => x !== id);

const relacional = (id: string): Extra => ({ implica: ['sql', 'banco-relacional'], relacionadas: outros(id, RELACIONAIS) });
const nuvem = (id: string): Extra => ({ implica: ['cloud'], relacionadas: outros(id, NUVENS) });
const ci = (id: string, ...implica: string[]): Extra => ({ implica: ['ci-cd', ...implica], relacionadas: outros(id, CI) });

const BASE: SkillDef[] = [
  ...grupo('linguagem', [
    ['java', 'Java', ['jvm'], { relacionadas: ['kotlin'] }],
    ['kotlin', 'Kotlin'],
    ['scala', 'Scala'],
    ['groovy', 'Groovy'],
    ['javascript', 'JavaScript', ['js', 'ecmascript', 'es6', 'vanilla js', 'vanillajs']],
    ['typescript', 'TypeScript', [], { implica: ['javascript'] }],
    ['python', 'Python', ['python3', 'python 3']],
    ['go', 'Go', ['golang', 'linguagem go'], { regex: `${A}Go${D}` }],
    ['rust', 'Rust'],
    ['c', 'C', ['linguagem c', 'ansi c'], {
      // "C" sozinho só vale fora de "categoria C" (CNH), "nível C1" etc.
      regex: `(?<!(?:[Cc]ategoria|[Cc]lasse|CNH|cnh|[Tt]ipo|[Nn][ií]vel|[Pp]lano)\\s)${A}C(?![\\p{L}\\p{N}_#+])(?!\\.\\s*\\p{Lu})`,
    }],
    ['cpp', 'C++', ['cpp', 'c plus plus']],
    ['csharp', 'C#', ['c sharp', 'csharp'], { implica: ['dotnet'] }],
    ['fsharp', 'F#', ['f sharp'], { implica: ['dotnet'] }],
    ['php', 'PHP'],
    ['ruby', 'Ruby'],
    ['elixir', 'Elixir'],
    ['erlang', 'Erlang'],
    ['clojure', 'Clojure'],
    ['haskell', 'Haskell'],
    ['dart', 'Dart'],
    ['swift', 'Swift'],
    ['objective-c', 'Objective-C', ['objective c', 'objc']],
    // "R" sozinho não vale em "R$" nem em abreviação de rua ("R. Augusta").
    ['r', 'R', ['linguagem r', 'rstudio', 'r studio'], { regex: `${A}R(?![\\p{L}\\p{N}_$])(?!\\.\\s*\\p{Lu})` }],
    ['matlab', 'MATLAB'],
    ['perl', 'Perl'],
    ['lua', 'Lua', [], { regex: `${A}Lua${D}` }],
    ['shell', 'Shell Script', ['shell', 'shellscript', 'shell scripting', 'bash', 'zsh']],
    ['powershell', 'PowerShell', ['power shell']],
    ['vba', 'VBA'],
    ['delphi', 'Delphi'],
    ['cobol', 'COBOL'],
    ['vbnet', 'VB.NET', ['visual basic'], { implica: ['dotnet'] }],
    ['solidity', 'Solidity'],
    ['assembly', 'Assembly', ['assembler']],
    ['abap', 'ABAP', [], { implica: ['sap'] }],
  ]),

  ...grupo('banco', [
    ['sql', 'SQL', ['linguagem sql']],
    ['plsql', 'PL/SQL', ['plsql', 'pl sql'], { implica: ['sql', 'oracle'] }],
    ['tsql', 'T-SQL', ['tsql', 'transact-sql', 'transact sql'], { implica: ['sql', 'sql-server'] }],
    ['banco-relacional', 'Bancos relacionais', [
      'banco relacional', 'banco de dados relacional', 'bancos de dados relacionais', 'banco de dados relacionais',
      'sgbd relacional', 'sgbds relacionais', 'rdbms', 'banco de dados sql', 'bancos de dados sql', 'bancos sql',
      'relational', 'relational database', 'relational databases', 'sql databases', 'relacional', 'relacionais',
    ], { implica: ['sql'] }],
    ['postgresql', 'PostgreSQL', ['postgres', 'postgre', 'pgsql'], relacional('postgresql')],
    ['mysql', 'MySQL', [], relacional('mysql')],
    ['mariadb', 'MariaDB', [], relacional('mariadb')],
    ['sql-server', 'SQL Server', ['mssql', 'ms sql', 'ms sql server', 'microsoft sql server'], relacional('sql-server')],
    ['oracle', 'Oracle Database', ['oracle', 'oracle db', 'banco oracle'], relacional('oracle')],
    ['db2', 'IBM Db2', ['db2'], relacional('db2')],
    ['sqlite', 'SQLite', [], { implica: ['sql', 'banco-relacional'] }],
    ['h2', 'H2 Database', ['banco h2'], { implica: ['sql', 'banco-relacional'] }],
    ['nosql', 'NoSQL', [
      'no-sql', 'banco nosql', 'bancos nosql', 'banco de dados nosql', 'bancos de dados nosql',
      'banco não relacional', 'bancos não relacionais', 'banco de dados não relacional', 'bancos de dados não relacionais',
      'não relacional', 'não relacionais', 'non-relational', 'non-relational databases', 'nosql databases',
    ]],
    ['mongodb', 'MongoDB', ['mongo', 'mongo db'], { implica: ['nosql'] }],
    ['redis', 'Redis', [], { implica: ['nosql'] }],
    ['cassandra', 'Cassandra', ['apache cassandra'], { implica: ['nosql'] }],
    ['dynamodb', 'DynamoDB', ['dynamo', 'dynamo db', 'aws dynamodb'], { implica: ['nosql', 'aws'] }],
    ['elasticsearch', 'Elasticsearch', ['elastic search', 'elastic'], { implica: ['nosql'] }],
    ['opensearch', 'OpenSearch', ['open search'], { relacionadas: ['elasticsearch'] }],
    ['neo4j', 'Neo4j', [], { implica: ['nosql'] }],
    ['couchbase', 'Couchbase', [], { implica: ['nosql'] }],
    ['firebase', 'Firebase', ['firestore', 'firebase realtime database'], { implica: ['nosql'] }],
    ['memcached', 'Memcached'],
  ]),

  ...grupo('framework', [
    ['spring', 'Spring', ['spring framework']],
    ['spring-boot', 'Spring Boot', ['springboot', 'spring-boot'], { implica: ['spring'] }],
    ['spring-security', 'Spring Security', [], { implica: ['spring'] }],
    ['spring-data', 'Spring Data', ['spring data mongodb'], { implica: ['spring'] }],
    ['spring-data-jpa', 'Spring Data JPA', ['data jpa'], { implica: ['spring-data', 'jpa'] }],
    ['spring-cloud', 'Spring Cloud', [], { implica: ['spring'] }],
    ['spring-batch', 'Spring Batch', [], { implica: ['spring'] }],
    ['spring-mvc', 'Spring MVC', [], { implica: ['spring'] }],
    ['webflux', 'Spring WebFlux', ['webflux', 'project reactor'], { implica: ['spring'] }],
    ['jpa', 'JPA', ['java persistence api', 'jakarta persistence'], { implica: ['orm'] }],
    ['hibernate', 'Hibernate', ['hibernate orm'], { implica: ['jpa', 'orm'] }],
    ['quarkus', 'Quarkus', [], { relacionadas: ['spring-boot', 'micronaut'] }],
    ['micronaut', 'Micronaut', [], { relacionadas: ['spring-boot'] }],
    ['jakarta-ee', 'Jakarta EE', ['java ee', 'j2ee', 'jee', 'javaee']],
    ['jsf', 'JSF', ['java server faces', 'javaserver faces', 'primefaces']],
    ['struts', 'Struts', ['apache struts']],
    ['vertx', 'Vert.x', ['vertx']],
    ['lombok', 'Lombok'],
    ['mapstruct', 'MapStruct'],
    ['flyway', 'Flyway', [], { relacionadas: ['liquibase'] }],
    ['liquibase', 'Liquibase'],
    ['nodejs', 'Node.js', ['nodejs', 'node js', 'node'], { implica: ['javascript'] }],
    ['express', 'Express', ['express.js', 'expressjs'], { implica: ['nodejs'], regex: `${A}Express${D}` }],
    ['nestjs', 'NestJS', ['nest.js', 'nest js'], { implica: ['nodejs', 'typescript'] }],
    ['fastify', 'Fastify', [], { implica: ['nodejs'] }],
    ['django', 'Django', ['django rest framework', 'drf'], { implica: ['python'] }],
    ['flask', 'Flask', [], { implica: ['python'] }],
    ['fastapi', 'FastAPI', ['fast api'], { implica: ['python'] }],
    ['rails', 'Ruby on Rails', ['rails', 'ror'], { implica: ['ruby'] }],
    ['laravel', 'Laravel', [], { implica: ['php'] }],
    ['symfony', 'Symfony', [], { implica: ['php'] }],
    ['dotnet', '.NET', ['dotnet', '.net framework']],
    ['dotnet-core', '.NET Core', ['dotnet core'], { implica: ['dotnet'] }],
    ['aspnet', 'ASP.NET', ['asp.net core', 'asp.net mvc', 'aspnet', 'aspnet core', 'asp net'], { implica: ['dotnet'] }],
    ['entity-framework', 'Entity Framework', ['entity framework core', 'ef core', 'entityframework'], { implica: ['dotnet', 'orm'] }],
    ['blazor', 'Blazor', [], { implica: ['dotnet'] }],
    ['ktor', 'Ktor', [], { implica: ['kotlin'] }],
    ['akka', 'Akka'],
    ['play', 'Play Framework'],
  ]),

  ...grupo('pratica', [
    ['orm', 'ORM', ['mapeamento objeto-relacional', 'mapeamento objeto relacional']],
    // Só "SOA" em maiúsculas: "soa" também é verbo ("soa bem").
    ['soa', 'SOA (arquitetura orientada a serviços)', [
      'arquitetura orientada a serviços', 'service oriented architecture', 'service-oriented architecture',
    ], { regex: `${A}SOA${D}`, relacionadas: ['microsservicos'] }],
    ['rest', 'APIs REST', [
      'rest', 'restful', 'api rest', 'rest api', 'rest apis', 'api restful', 'apis restful',
      'restful api', 'restful apis', 'web services rest', 'serviços rest',
    ]],
    ['soap', 'SOAP', ['web services soap']],
    ['graphql', 'GraphQL'],
    ['grpc', 'gRPC'],
    ['websocket', 'WebSockets', ['websocket', 'web sockets', 'web socket', 'socket.io', 'sockets', 'sockjs']],
    ['mensageria', 'Mensageria', [
      'filas de mensagens', 'fila de mensagens', 'message broker', 'message brokers', 'messaging', 'sistemas de mensageria',
    ]],
    ['event-driven', 'Arquitetura orientada a eventos', [
      'orientada a eventos', 'orientado a eventos', 'event-driven', 'event driven', 'event sourcing', 'arquitetura de eventos',
    ], { implica: ['mensageria'] }],
    ['microsservicos', 'Microsserviços', [
      'microsserviço', 'microserviços', 'microserviço', 'micro serviços', 'micro-serviços',
      'microservices', 'microservice', 'micro services',
    ]],
    ['clean-code', 'Clean Code', ['código limpo']],
    ['clean-architecture', 'Clean Architecture', ['arquitetura limpa']],
    ['hexagonal', 'Arquitetura hexagonal', ['hexagonal', 'ports and adapters', 'portas e adaptadores']],
    ['ddd', 'DDD', ['domain driven design', 'domain-driven design', 'design orientado a domínio']],
    // "sólidos conhecimentos" e "solid experience" não podem virar SOLID.
    ['solid', 'SOLID', ['princípios solid'], { regex: `${A}SOLID${D}` }],
    ['design-patterns', 'Design Patterns', ['design pattern', 'padrões de projeto', 'padrão de projeto', 'padrões de design', 'gof']],
    ['poo', 'Orientação a objetos', [
      'poo', 'oop', 'orientação a objeto', 'orientado a objetos', 'programação orientada a objetos',
      'programação orientada a objeto', 'object oriented', 'object oriented programming', 'object-oriented programming',
    ]],
    ['funcional', 'Programação funcional', ['functional programming']],
    ['code-review', 'Code review', ['code reviews', 'revisão de código', 'revisões de código', 'pull request', 'pull requests']],
    ['estruturas-dados', 'Estruturas de dados', ['estrutura de dados', 'data structures', 'algoritmos e estruturas de dados']],
    ['arquitetura-software', 'Arquitetura de software', [
      'arquitetura de sistemas', 'system design', 'design de sistemas', 'arquitetura em camadas', 'arquitetura de camadas',
      'layered architecture',
    ]],
    ['sistemas-distribuidos', 'Sistemas distribuídos', ['distributed systems', 'aplicações distribuídas']],
    ['multithreading', 'Programação concorrente', [
      'multithreading', 'multi-threading', 'programação paralela', 'concorrência e paralelismo', 'threads',
    ]],
    ['caching', 'Caching', ['cache', 'cache distribuído', 'estratégias de cache']],
    ['seguranca-app', 'Segurança de aplicações', ['owasp', 'appsec', 'segurança da informação', 'secure coding', 'desenvolvimento seguro']],
    ['lgpd', 'LGPD', ['lei geral de proteção de dados', 'gdpr']],
    ['oauth', 'OAuth 2.0', ['oauth', 'oauth2', 'oauth 2', 'openid connect', 'oidc']],
    ['jwt', 'JWT', ['json web token', 'json web tokens']],
    ['feature-flags', 'Feature flags', ['feature flag', 'feature toggle', 'feature toggles', 'unleash', 'launchdarkly']],
    ['serverless', 'Serverless', ['arquitetura serverless', 'serverless framework', 'sem servidor']],
    ['iac', 'Infraestrutura como código', ['iac', 'infrastructure as code', 'infra como código']],
    ['ci-cd', 'CI/CD', [
      'ci cd', 'cicd', 'ci-cd', 'integração contínua', 'entrega contínua', 'integração e entrega contínua',
      'integração e entrega contínuas', 'deploy contínuo', 'implantação contínua',
      'continuous integration', 'continuous delivery', 'continuous deployment', 'esteira de deploy', 'esteiras de deploy',
      'pipeline de deploy', 'pipelines de deploy',
    ]],
    ['versionamento', 'Controle de versão', [
      'versionamento de código', 'controle de versionamento', 'controle de versões', 'version control', 'ferramentas de versionamento',
    ]],
    ['responsividade', 'Design responsivo', [
      'responsividade', 'layout responsivo', 'layouts responsivos', 'interfaces responsivas', 'responsive design',
      'mobile first', 'mobile-first', 'responsivo', 'responsiva', 'responsivos', 'responsivas',
    ]],
    ['acessibilidade', 'Acessibilidade', ['a11y', 'wcag', 'acessibilidade web']],
    ['seo', 'SEO'],
    ['ux-ui', 'UX/UI', ['ui/ux', 'ux', 'ux design', 'ui design', 'user experience', 'experiência do usuário', 'usabilidade']],
    ['pwa', 'PWA', ['progressive web app', 'progressive web apps']],
    ['microfrontends', 'Micro-frontends', [
      'micro frontends', 'microfrontends', 'micro frontend', 'microfrontend', 'micro front-end', 'micro front-ends',
    ]],
    ['observabilidade', 'Observabilidade', ['observability', 'monitoramento de aplicações', 'monitoramento e observabilidade', 'apm']],
    ['containers', 'Containers', ['contêineres', 'containerização', 'conteinerização']],
  ]),

  ...grupo('frontend', [
    ['html', 'HTML', ['html5']],
    ['css', 'CSS', ['css3']],
    ['sass', 'Sass', ['scss'], { implica: ['css'] }],
    ['react', 'React', ['react.js', 'reactjs', 'react js'], { implica: ['javascript'] }],
    ['nextjs', 'Next.js', ['nextjs', 'next js'], { implica: ['react'] }],
    ['angular', 'Angular', [], { implica: ['typescript'], relacionadas: ['angularjs'] }],
    ['angularjs', 'AngularJS', ['angular.js', 'angular js'], { implica: ['javascript'] }],
    ['vue', 'Vue.js', ['vue', 'vuejs', 'vue js'], { implica: ['javascript'] }],
    ['nuxt', 'Nuxt', ['nuxt.js', 'nuxtjs'], { implica: ['vue'] }],
    ['svelte', 'Svelte', ['sveltekit'], { implica: ['javascript'] }],
    ['jquery', 'jQuery', [], { implica: ['javascript'] }],
    ['bootstrap', 'Bootstrap', [], { implica: ['css'] }],
    ['tailwind', 'Tailwind CSS', ['tailwind', 'tailwindcss'], { implica: ['css'] }],
    ['material-ui', 'Material UI', ['mui', 'material-ui', 'material design']],
    ['styled-components', 'Styled Components', ['styled-components']],
    ['redux', 'Redux', ['redux toolkit']],
    ['rxjs', 'RxJS'],
    ['webpack', 'Webpack'],
    ['vite', 'Vite'],
    ['storybook', 'Storybook'],
    ['d3', 'D3.js', ['d3']],
    ['thymeleaf', 'Thymeleaf'],
  ]),

  ...grupo('mobile', [
    ['react-native', 'React Native', ['react-native'], { implica: ['react'] }],
    ['flutter', 'Flutter', [], { implica: ['dart'] }],
    ['android', 'Android', ['android sdk', 'android nativo']],
    ['ios', 'iOS', ['ios nativo']],
    ['swiftui', 'SwiftUI', [], { implica: ['swift', 'ios'] }],
    ['jetpack-compose', 'Jetpack Compose', [], { implica: ['android', 'kotlin'] }],
    ['xamarin', 'Xamarin', [], { implica: ['dotnet'] }],
    ['ionic', 'Ionic'],
  ]),

  ...grupo('cloud', [
    ['cloud', 'Cloud', [
      'cloud computing', 'computação em nuvem', 'nuvem', 'cloud pública', 'nuvem pública', 'cloud native', 'cloud-native', 'ambiente cloud',
      'ambientes cloud', 'serviços de nuvem', 'serviços cloud',
    ]],
    ['aws', 'AWS', ['amazon web services'], nuvem('aws')],
    ['azure', 'Azure', ['microsoft azure'], nuvem('azure')],
    ['gcp', 'Google Cloud', ['gcp', 'google cloud platform'], nuvem('gcp')],
    ['oci', 'Oracle Cloud', ['oci', 'oracle cloud infrastructure'], { implica: ['cloud'] }],
    ['heroku', 'Heroku', [], { implica: ['cloud'] }],
    ['vercel', 'Vercel'],
    ['netlify', 'Netlify'],
    ['digitalocean', 'DigitalOcean', ['digital ocean'], { implica: ['cloud'] }],
    ['ec2', 'EC2', ['aws ec2', 'amazon ec2'], { implica: ['aws'] }],
    ['s3', 'S3', ['aws s3', 'amazon s3'], { implica: ['aws'] }],
    // Só "Lambda" com maiúscula: "expressões lambda" de Java não é AWS.
    ['lambda', 'AWS Lambda', ['aws lambda', 'amazon lambda', 'funções lambda', 'função lambda', 'lambda functions'], {
      implica: ['aws', 'serverless'], regex: `${A}Lambdas?${D}`,
    }],
    ['sqs', 'SQS', ['aws sqs', 'amazon sqs'], { implica: ['aws', 'mensageria'] }],
    ['sns', 'SNS', ['aws sns', 'amazon sns'], { implica: ['aws', 'mensageria'] }],
    ['ecs', 'ECS', ['aws ecs', 'amazon ecs'], { implica: ['aws', 'containers'] }],
    ['eks', 'EKS', ['aws eks', 'amazon eks'], { implica: ['aws', 'kubernetes'] }],
    ['fargate', 'Fargate', ['aws fargate'], { implica: ['aws', 'containers'] }],
    ['rds', 'RDS', ['aws rds', 'amazon rds'], { implica: ['aws', 'banco-relacional'] }],
    ['aurora', 'Amazon Aurora', ['aws aurora'], { implica: ['aws', 'banco-relacional'] }],
    ['cloudwatch', 'CloudWatch', ['cloud watch', 'aws cloudwatch'], { implica: ['aws', 'observabilidade'] }],
    ['cloudformation', 'CloudFormation', ['cloud formation', 'aws cloudformation'], { implica: ['aws', 'iac'] }],
    ['api-gateway', 'API Gateway', ['aws api gateway', 'amazon api gateway', 'api gateways']],
    ['step-functions', 'Step Functions', ['aws step functions'], { implica: ['aws'] }],
    ['kinesis', 'Kinesis', ['aws kinesis', 'amazon kinesis'], { implica: ['aws'] }],
    // "Athena" e "Glue" sozinhos só com maiúscula (em lista de serviços AWS).
    ['athena', 'Amazon Athena', ['amazon athena', 'aws athena'], { implica: ['aws'], regex: `${A}Athena${D}` }],
    ['eventbridge', 'EventBridge', ['event bridge', 'aws eventbridge'], { implica: ['aws', 'mensageria'] }],
    ['cognito', 'Cognito', ['aws cognito', 'amazon cognito'], { implica: ['aws'] }],
    ['beanstalk', 'Elastic Beanstalk', ['aws elastic beanstalk', 'beanstalk'], { implica: ['aws'] }],
    ['azure-functions', 'Azure Functions', [], { implica: ['azure', 'serverless'] }],
    ['aks', 'AKS', ['azure kubernetes service'], { implica: ['azure', 'kubernetes'] }],
    ['azure-service-bus', 'Azure Service Bus', ['service bus'], { implica: ['azure', 'mensageria'] }],
    ['cloud-run', 'Cloud Run', ['google cloud run'], { implica: ['gcp', 'containers'] }],
    ['gke', 'GKE', ['google kubernetes engine'], { implica: ['gcp', 'kubernetes'] }],
    ['pubsub', 'Pub/Sub', ['pubsub', 'google pub/sub', 'gcp pub/sub'], { implica: ['gcp', 'mensageria'] }],
    ['cloud-functions', 'Cloud Functions', ['google cloud functions'], { implica: ['gcp', 'serverless'] }],
  ]),

  ...grupo('devops', [
    ['devops', 'DevOps', ['cultura devops', 'práticas devops', 'devsecops']],
    ['docker', 'Docker', [], { implica: ['containers'] }],
    ['docker-compose', 'Docker Compose', ['docker-compose'], { implica: ['docker'] }],
    ['kubernetes', 'Kubernetes', ['k8s'], { implica: ['containers'] }],
    ['helm', 'Helm', [], { implica: ['kubernetes'] }],
    ['openshift', 'OpenShift', ['open shift'], { implica: ['kubernetes'] }],
    ['istio', 'Istio', [], { implica: ['kubernetes'] }],
    ['terraform', 'Terraform', [], { implica: ['iac'] }],
    ['ansible', 'Ansible', [], { implica: ['iac'] }],
    ['pulumi', 'Pulumi', [], { implica: ['iac'] }],
    ['jenkins', 'Jenkins', [], ci('jenkins')],
    ['github-actions', 'GitHub Actions', ['gh actions'], ci('github-actions', 'github')],
    ['gitlab-ci', 'GitLab CI', ['gitlab ci/cd', 'gitlab-ci', 'gitlab pipelines'], ci('gitlab-ci', 'gitlab')],
    ['azure-devops', 'Azure DevOps', ['vsts', 'azure pipelines'], ci('azure-devops')],
    ['circleci', 'CircleCI', ['circle ci'], ci('circleci')],
    ['bitbucket-pipelines', 'Bitbucket Pipelines', [], ci('bitbucket-pipelines', 'bitbucket')],
    ['argocd', 'Argo CD', ['argocd', 'gitops'], { implica: ['ci-cd', 'kubernetes'] }],
    ['linux', 'Linux', ['ubuntu', 'debian', 'centos', 'red hat', 'rhel']],
    ['unix', 'Unix', ['unix-like'], { implica: ['sistemas-operacionais'], relacionadas: ['linux'] }],
    ['nginx', 'Nginx'],
    ['apache-http', 'Apache HTTP Server', ['apache httpd', 'apache web server']],
    ['tomcat', 'Tomcat', ['apache tomcat']],
    ['wildfly', 'WildFly', ['jboss']],
    ['prometheus', 'Prometheus', [], { implica: ['observabilidade'] }],
    ['grafana', 'Grafana', [], { implica: ['observabilidade'] }],
    ['datadog', 'Datadog', ['data dog'], { implica: ['observabilidade'] }],
    ['new-relic', 'New Relic', ['newrelic'], { implica: ['observabilidade'] }],
    ['splunk', 'Splunk', [], { implica: ['observabilidade'] }],
    ['elk', 'ELK', ['elk stack', 'elastic stack', 'kibana', 'logstash'], { implica: ['observabilidade'] }],
    ['opentelemetry', 'OpenTelemetry', ['open telemetry', 'otel'], { implica: ['observabilidade'] }],
    ['sonarqube', 'SonarQube', ['sonar', 'sonarcloud', 'sonar qube']],
    ['vault', 'HashiCorp Vault', ['hashicorp vault']],
    ['git', 'Git', ['gitflow', 'git flow'], { implica: ['versionamento'] }],
    ['github', 'GitHub', [], { implica: ['git'] }],
    ['gitlab', 'GitLab', [], { implica: ['git'] }],
    ['bitbucket', 'Bitbucket', [], { implica: ['git'] }],
    ['svn', 'SVN', ['subversion'], { implica: ['versionamento'] }],
    ['kafka', 'Apache Kafka', ['kafka', 'kafka streams'], { implica: ['mensageria'] }],
    ['rabbitmq', 'RabbitMQ', ['rabbit mq', 'rabbit'], { implica: ['mensageria'] }],
    ['activemq', 'ActiveMQ', ['active mq'], { implica: ['mensageria'] }],
  ]),

  ...grupo('teste', [
    ['testes-automatizados', 'Testes automatizados', [
      'teste automatizado', 'automação de testes', 'automação de teste', 'test automation', 'automated tests', 'automated testing',
      'write tests', 'writing tests',
    ]],
    ['testes-unitarios', 'Testes unitários', ['teste unitário', 'testes de unidade', 'unit tests', 'unit test', 'unit testing'], {
      implica: ['testes-automatizados'],
    }],
    ['testes-integracao', 'Testes de integração', ['teste de integração', 'integration tests', 'integration testing'], {
      implica: ['testes-automatizados'],
    }],
    ['testes-e2e', 'Testes end-to-end', ['testes e2e', 'teste e2e', 'e2e', 'end-to-end', 'end to end'], {
      implica: ['testes-automatizados'],
    }],
    ['testes-performance', 'Testes de performance', [
      'teste de performance', 'testes de carga', 'teste de carga', 'testes de estresse', 'load testing', 'performance testing',
    ]],
    ['junit', 'JUnit', ['junit5', 'junit 5'], { implica: ['testes-unitarios'] }],
    ['mockito', 'Mockito', [], { implica: ['testes-unitarios'] }],
    ['testcontainers', 'Testcontainers', ['test containers'], { implica: ['testes-integracao'] }],
    ['rest-assured', 'REST Assured', ['restassured', 'rest-assured'], { implica: ['testes-automatizados'] }],
    ['cucumber', 'Cucumber', [], { implica: ['bdd', 'testes-automatizados'] }],
    ['selenium', 'Selenium', ['selenium webdriver', 'webdriver'], { implica: ['testes-e2e'] }],
    ['cypress', 'Cypress', [], { implica: ['testes-e2e'] }],
    ['playwright', 'Playwright', [], { implica: ['testes-e2e'] }],
    ['appium', 'Appium', [], { implica: ['testes-e2e'] }],
    ['jest', 'Jest', [], { implica: ['testes-unitarios'], relacionadas: ['vitest'] }],
    ['vitest', 'Vitest', [], { implica: ['testes-unitarios'] }],
    ['mocha', 'Mocha', [], { implica: ['testes-unitarios'] }],
    ['testing-library', 'Testing Library', ['react testing library', '@testing-library'], { implica: ['testes-automatizados'] }],
    ['pytest', 'Pytest', ['py.test'], { implica: ['testes-unitarios', 'python'] }],
    ['jmeter', 'JMeter', ['apache jmeter'], { implica: ['testes-performance'] }],
    ['k6', 'k6', ['grafana k6'], { implica: ['testes-performance'] }],
    ['robot-framework', 'Robot Framework', ['robotframework'], { implica: ['testes-automatizados'] }],
    ['postman', 'Postman'],
    ['insomnia', 'Insomnia'],
    ['tdd', 'TDD', ['test driven development', 'test-driven development', 'desenvolvimento orientado a testes'], {
      implica: ['testes-automatizados'],
    }],
    ['bdd', 'BDD', ['behavior driven development', 'behaviour driven development', 'desenvolvimento orientado a comportamento']],
  ]),

  ...grupo('ferramenta', [
    ['openapi', 'Swagger/OpenAPI', ['swagger', 'openapi', 'open api']],
    ['jira', 'Jira'],
    ['confluence', 'Confluence'],
    ['maven', 'Maven', ['apache maven'], { relacionadas: ['gradle'] }],
    ['gradle', 'Gradle'],
    ['npm', 'npm', ['yarn', 'pnpm']],
    ['keycloak', 'Keycloak'],
    ['jasper', 'JasperReports', ['jasper reports', 'jasper', 'ireport']],
    ['apache-poi', 'Apache POI'],
    ['sap', 'SAP', ['sap erp', 's/4hana', 'sap s/4hana']],
    ['salesforce', 'Salesforce'],
    ['servicenow', 'ServiceNow', ['service now']],
    ['zendesk', 'Zendesk'],
    ['figma', 'Figma'],
  ]),

  ...grupo('metodologia', [
    ['agil', 'Metodologias ágeis', [
      'metodologia ágil', 'métodos ágeis', 'agile', 'ágil', 'ágeis', 'agilidade', 'ambiente ágil', 'times ágeis', 'equipes ágeis',
    ]],
    ['scrum', 'Scrum', [], { implica: ['agil'] }],
    ['kanban', 'Kanban', [], { implica: ['agil'] }],
    ['safe', 'SAFe', ['scaled agile framework', 'scaled agile'], { implica: ['agil'], regex: `${A}SAFe${D}` }],
    ['lean', 'Lean', ['lean six sigma']],
    ['xp', 'Extreme Programming', [], { implica: ['agil'] }],
    ['itil', 'ITIL', ['gestão de incidentes', 'gerenciamento de incidentes', 'gestão de serviços de ti']],
  ]),

  ...grupo('dados', [
    ['etl', 'ETL', ['elt', 'pipeline de dados', 'pipelines de dados', 'data pipeline', 'data pipelines']],
    ['data-warehouse', 'Data Warehouse', ['datawarehouse', 'data warehousing', 'dw']],
    ['data-lake', 'Data Lake', ['datalake', 'lakehouse', 'data lakehouse']],
    ['modelagem-dados', 'Modelagem de dados', ['modelagem de banco de dados', 'modelagem relacional', 'modelagem dimensional', 'data modeling']],
    ['bi', 'Business Intelligence', ['bi']],
    ['big-data', 'Big Data'],
    ['machine-learning', 'Machine Learning', ['ml', 'aprendizado de máquina', 'aprendizagem de máquina']],
    ['deep-learning', 'Deep Learning', ['aprendizado profundo', 'redes neurais', 'neural networks'], { implica: ['machine-learning'] }],
    // "IA"/"AI" só em maiúsculas: "aí" vira "ai" depois de tirar o acento.
    ['ia', 'Inteligência artificial', ['inteligência artificial', 'artificial intelligence'], { regex: `${A}(?:IA|AI)${D}` }],
    ['ia-generativa', 'IA generativa', [
      'genai', 'generative ai', 'llm', 'llms', 'large language models', 'prompt engineering', 'engenharia de prompt', 'rag',
      'inteligência artificial generativa', 'ia gen', 'agentes de ia', 'agentes de inteligência artificial', 'ai agents',
    ], { implica: ['ia'] }],
    ['nlp', 'NLP', ['processamento de linguagem natural', 'natural language processing', 'pln'], { implica: ['machine-learning'] }],
    ['visao-computacional', 'Visão computacional', ['computer vision', 'opencv'], { implica: ['machine-learning'] }],
    ['estatistica', 'Estatística', ['statistics', 'análise estatística']],
    ['pandas', 'Pandas', [], { implica: ['python'] }],
    ['numpy', 'NumPy', [], { implica: ['python'] }],
    ['scikit-learn', 'scikit-learn', ['sklearn', 'scikit learn'], { implica: ['machine-learning', 'python'] }],
    ['tensorflow', 'TensorFlow', [], { implica: ['deep-learning'] }],
    ['pytorch', 'PyTorch', ['torch'], { implica: ['deep-learning'] }],
    ['keras', 'Keras', [], { implica: ['deep-learning'] }],
    ['spark', 'Apache Spark', ['spark', 'spark sql'], { implica: ['big-data'] }],
    ['pyspark', 'PySpark', [], { implica: ['spark', 'python'] }],
    ['hadoop', 'Hadoop', ['apache hadoop', 'hdfs'], { implica: ['big-data'] }],
    ['hive', 'Hive', ['apache hive'], { implica: ['big-data'] }],
    ['airflow', 'Apache Airflow', ['airflow'], { implica: ['etl'] }],
    ['dbt', 'dbt', ['data build tool'], { implica: ['etl'] }],
    ['databricks', 'Databricks', [], { implica: ['spark'] }],
    ['snowflake', 'Snowflake', [], { implica: ['data-warehouse'] }],
    ['bigquery', 'BigQuery', ['big query', 'google bigquery'], { implica: ['gcp', 'data-warehouse'] }],
    ['redshift', 'Amazon Redshift', ['redshift', 'aws redshift'], { implica: ['aws', 'data-warehouse'] }],
    ['glue', 'AWS Glue', ['aws glue'], { implica: ['aws', 'etl'], regex: `${A}Glue${D}` }],
    ['clickhouse', 'ClickHouse'],
    ['jupyter', 'Jupyter', ['jupyter notebook', 'jupyter notebooks']],
    ['mlflow', 'MLflow'],
    ['langchain', 'LangChain', [], { implica: ['ia-generativa'] }],
    ['hugging-face', 'Hugging Face', ['huggingface']],
    ['excel', 'Excel', ['excel avançado', 'microsoft excel']],
    ['power-bi', 'Power BI', ['powerbi'], { implica: ['bi'] }],
    ['tableau', 'Tableau', [], { implica: ['bi'] }],
    ['looker', 'Looker', ['looker studio', 'google data studio', 'data studio'], { implica: ['bi'] }],
    ['metabase', 'Metabase', [], { implica: ['bi'] }],
    ['engenharia-dados', 'Engenharia de dados', ['data engineering']],
  ]),

  // Termos que apareceram nas vagas reais (fixtures/vagas/reais).
  ...grupo('pratica', [
    ['logica', 'Lógica de programação', ['programming logic', 'algoritmos e lógica']],
    ['backend-dev', 'Desenvolvimento back-end', [
      'back-end', 'backend', 'back end', 'desenvolvimento backend', 'backend technologies', 'tecnologias back-end',
    ]],
    ['frontend-dev', 'Desenvolvimento front-end', ['front-end', 'frontend', 'front end', 'desenvolvimento frontend']],
    ['apis', 'APIs', ['api', 'desenvolvimento de apis', 'integração de apis', 'consumo de apis', 'web apis']],
    ['web-services', 'Web services', ['webservices', 'web service', 'webservice']],
    // Só "HTTP"/"HTTPS" em maiúsculas e fora de URL ("https://…" não conta).
    ['http', 'HTTP', ['protocolo http', 'protocolos http'], { regex: `${A}HTTPS?(?![\\p{L}\\p{N}_]|:\\/\\/)` }],
    // Sem "integração" sozinho: "testes unitários e de integração" não é integração de sistemas.
    ['integracao-sistemas', 'Integração de sistemas', [
      'integração entre sistemas', 'integrações entre sistemas', 'integrações de sistemas', 'integração com sistemas',
      'integrações com sistemas', 'integração com apis', 'integrações com apis', 'system integration', 'system integrations',
    ]],
    ['resiliencia', 'Padrões de resiliência', ['circuit breaker', 'retry', 'retries', 'idempotência', 'resilience patterns']],
    ['kiss-dry-yagni', 'KISS, DRY e YAGNI', ['princípio kiss', 'princípio dry', 'princípio yagni'], {
      regex: `${A}(?:KISS|DRY|YAGNI)${D}`,
    }],
    ['qualidade-software', 'Qualidade de software', [
      'testes de software', 'teste de software', 'garantia da qualidade', 'quality assurance', 'testes funcionais',
      'teste funcional', 'testes manuais', 'testes de qualidade',
    ]],
    ['documentacao', 'Documentação técnica', [
      'documentações técnicas', 'documentação de software', 'base de conhecimento', 'documentação', 'documentações',
    ]],
    ['requisitos', 'Levantamento de requisitos', [
      'análise de requisitos', 'engenharia de requisitos', 'requisitos funcionais', 'especificação de requisitos',
      'elicitação de requisitos', 'requirements gathering',
    ]],
    ['processos', 'Mapeamento de processos', ['desenho de processos', 'modelagem de processos', 'bpmn', 'bpm']],
    ['suporte', 'Suporte técnico', [
      'suporte a sistemas', 'suporte a usuários', 'suporte n1', 'suporte n2', 'suporte n3', 'atendimento n1', 'n1', 'n2',
      'n3', 'sustentação', 'sustentação de sistemas', 'troubleshooting',
    ]],
    ['blockchain', 'Blockchain', ['web3', 'smart contracts', 'contratos inteligentes', 'tokenização', 'tokenization']],
    // Vistos nas candidaturas da Fase 4.
    ['redes', 'Redes de computadores', [
      'redes de computadores', 'redes e internet', 'networking', 'tcp/ip', 'protocolos de rede', 'infraestrutura de redes',
    ]],
    ['manutencao-computadores', 'Manutenção de computadores', [
      'formatação de computadores', 'formatação e configuração de computadores', 'configuração de computadores',
      'manutenção de computadores', 'montagem e manutenção de computadores', 'manutenção de notebooks e computadores',
    ], { implica: ['suporte'] }],
    ['debugging', 'Depuração (debugging)', ['depuração', 'debugging', 'debug', 'ferramentas de depuração', 'depuração de código']],
  ]),
  ...grupo('ferramenta', [
    ['low-code', 'Low-code / No-code', [
      'low code', 'lowcode', 'low-code', 'no-code', 'no code', 'nocode', 'n8n', 'zapier', 'power automate', 'outsystems',
      'mendix', 'ferramentas de workflow',
    ]],
    ['chatbots', 'Chatbots', ['chatbot', 'nlu', 'dialogflow', 'bots conversacionais']],
    ['ai-coding', 'Ferramentas de IA para código', [
      'ai coding tools', 'claude code', 'github copilot', 'copilot', 'codex', 'assistentes de código',
      'ferramentas de ia para código', 'ferramentas de ia para desenvolvimento', 'lovable',
    ], { implica: ['ia-generativa'], regex: `${A}Cursor${D}` }],
    ['openai-api', 'OpenAI API', ['openai', 'chatgpt', 'gpt-4', 'gpt-4o'], { implica: ['ia-generativa'] }],
    ['claude', 'Claude (Anthropic)', ['anthropic', 'claude api'], { implica: ['ia-generativa'], regex: `${A}Claude${D}` }],
    ['xml', 'XML', ['xsd', 'xslt']],
    ['json', 'JSON'],
    ['office', 'Pacote Office', [
      'pacote office', 'microsoft office', 'microsoft 365', 'office 365', 'ferramentas de escritório', 'powerpoint',
      'outlook', 'google workspace',
    ], { regex: `${A}(?:Word|Teams)${D}` }],
    ['service-desk', 'Service desk / chamados', [
      'service desk', 'help desk', 'helpdesk', 'gestão de chamados', 'atendimento de chamados', 'sistema de chamados',
      'sistemas de chamados', 'ferramenta de chamados', 'ferramentas de chamados', 'abertura de chamados',
      'tratamento de chamados', 'chamados', 'tickets', 'itsm',
    ]],
    ['sistemas-operacionais', 'Sistemas operacionais', ['sistema operacional', 'windows server', 'windows']],
  ]),
];

// Implicações em lote: quem tem uma linguagem tem lógica de programação; Java comprova back-end etc.
const LINGUAGENS = BASE.filter((s) => s.categoria === 'linguagem').map((s) => s.id);
const IMPLICACOES: Array<[string[], string]> = [
  [LINGUAGENS, 'logica'],
  [[
    'java', 'kotlin', 'scala', 'python', 'go', 'rust', 'csharp', 'fsharp', 'vbnet', 'php', 'ruby', 'elixir', 'nodejs',
    'spring', 'dotnet', 'django', 'flask', 'fastapi', 'rails', 'laravel', 'symfony', 'nestjs', 'express', 'quarkus',
    'micronaut', 'jakarta-ee',
  ], 'backend-dev'],
  [[
    'html', 'css', 'react', 'angular', 'angularjs', 'vue', 'nextjs', 'nuxt', 'svelte', 'jquery', 'bootstrap', 'tailwind',
    'sass', 'material-ui',
  ], 'frontend-dev'],
  // Quem usa um framework de front-end escreve HTML e CSS.
  [['react', 'angular', 'angularjs', 'vue', 'svelte', 'jquery'], 'html'],
  [['react', 'angular', 'angularjs', 'vue', 'svelte'], 'css'],
  [['rest', 'graphql', 'grpc', 'soap', 'openapi', 'websocket'], 'apis'],
  [['rest', 'soap'], 'web-services'],
  [['apis'], 'integracao-sistemas'],
  [['microsservicos', 'event-driven'], 'sistemas-distribuidos'],
  [['testes-automatizados'], 'qualidade-software'],
  [['linux'], 'sistemas-operacionais'],
  [['excel'], 'office'],
  [['zendesk', 'servicenow'], 'service-desk'],
  [['service-desk'], 'suporte'],
  [['etl'], 'engenharia-dados'],
  [['solidity'], 'blockchain'],
];

/** Conceitos amplos: comprovados por quem os implica, mas nunca ponte para "parcial" (ver SkillDef.conceito). */
const CONCEITOS = [
  'logica', 'backend-dev', 'frontend-dev', 'apis', 'web-services', 'integracao-sistemas', 'qualidade-software',
  'sistemas-operacionais', 'suporte', 'service-desk', 'documentacao', 'containers', 'mensageria', 'cloud', 'ci-cd',
  'testes-automatizados', 'testes-unitarios', 'testes-integracao', 'testes-e2e', 'testes-performance', 'banco-relacional',
  'nosql', 'observabilidade', 'iac', 'versionamento', 'serverless', 'agil', 'orm', 'big-data', 'bi', 'etl',
  'engenharia-dados', 'data-warehouse', 'machine-learning', 'deep-learning', 'ia-generativa', 'blockchain',
  'sistemas-distribuidos',
];

function montar(skills: SkillDef[]): SkillDef[] {
  const porId = new Map(skills.map((s) => [s.id, s]));
  const pegar = (id: string) => {
    const s = porId.get(id);
    if (!s) throw new Error(`Skill "${id}" não está no dicionário`);
    return s;
  };
  for (const [ids, alvo] of IMPLICACOES) {
    pegar(alvo);
    for (const id of ids) {
      const s = pegar(id);
      s.implica = [...new Set([...(s.implica ?? []), alvo])];
    }
  }
  for (const id of CONCEITOS) pegar(id).conceito = true;
  return skills;
}

/**
 * Dicionário de tecnologia (Q12, Q18). Aliases são comparados sem acento e sem diferença
 * de maiúsculas; cada grafia só pode aparecer uma vez no dicionário inteiro.
 */
export const SKILLS: SkillDef[] = montar(BASE);

/** Grafias que valem por mais de uma skill, todas exigidas. */
export const COMBINACOES: Array<[string, string[]]> = [
  ['testes unitários e de integração', ['testes-unitarios', 'testes-integracao']],
  ['testes unitários e integração', ['testes-unitarios', 'testes-integracao']],
  ['testes de unidade e integração', ['testes-unitarios', 'testes-integracao']],
  ['unitários e de integração', ['testes-unitarios', 'testes-integracao']],
  ['unit and integration tests', ['testes-unitarios', 'testes-integracao']],
  ['apis e integrações', ['apis', 'integracao-sistemas']],
  ['html/css', ['html', 'css']],
  ['html5/css3', ['html', 'css']],
];
