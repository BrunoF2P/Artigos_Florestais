# Scientia — Scopus Base Manager (SBM)

Scientia (Scopus Base Manager) é uma plataforma analítica de alto desempenho construída em **HTML5, CSS3 e JavaScript puro (ES6+)** voltada para o processamento, normalização, auditoria e visualização de bases de dados bibliográficas exportadas da plataforma **Scopus**.

A aplicação foi desenhada com foco em design instrucional, performance e responsividade, operando de forma 100% autônoma no navegador do usuário e integrando um robusto ecossistema de sincronização relacional com o **Supabase** para persistência e compartilhamento de dados.

---

## 🚀 Tecnologias, Linguagens e Ferramentas Utilizadas

O projeto adota uma arquitetura orientada a componentes modulares em Javascript puro para o front-end de forma a garantir máxima modularidade de código, facilidade de auditoria e carregamento ultra instantâneo.

*   **Linguagens de Programação e Marcação**:
    *   **HTML5 Semântico**: Estruturação otimizada para acessibilidade e organização lógica das seções de navegação em abas.
    *   **CSS3 Moderno**: Folhas de estilo robustas com variáveis de tema centrais (CSS Variables), modo escuro (Dark Mode) ativado nativamente, animações suaves de transição e layouts flexíveis (Flexbox e Grid).
    *   **JavaScript (ES6+)**: Mecanismo de reatividade assíncrono, estruturação de fluxos complexos, controle físico de atração e repulsão vetorial e gerenciamento de estados.
*   **Bibliotecas e APIs de Terceiros (CDNs de Alto Desempenho)**:
    *   **PapaParse (v5.4.1)**: Parser de arquivos CSV com suporte para streaming de dados, tratando anomalias como aspas aninhadas e quebras de linha em células (essencial para o campo de referências).
    *   **Chart.js (v4.4.1)**: Motor gráfico vetorial de alto desempenho utilizado para renderizar os 8 indicadores analíticos da aplicação.
    *   **Lucide Icons**: Pacote de ícones minimalistas e modernos renderizados dinamicamente via canvas vetorial do Lucide.
*   **Persistência de Dados e Banco de Dados Relacional**:
    *   **Supabase (PostgreSQL)**: Integração via cliente Javascript SDK para armazenamento desacoplado.
    *   **PL/pgSQL**: Procedures robustas criadas sob medida para processamento de payloads densos em formato JSONB diretamente no servidor de banco de dados, particionando em lotes (batch chunks) e prevenindo timeouts de conexão.
    *   **SQL Views**: Múltiplas junções otimizadas baseadas em views como `vw_artigos_completos` para recuperar e desmembrar estruturas de tabelas relacionais em frações de segundo.

---

## 📖 Guia de Uso Passo a Passo

### Passo 1: Preparando a Exportação dos Dados no Scopus
Para usufruir de todas as análises de coautorias, palavras-chave e citações, você precisará exportar seus dados corretamente:
1. Acesse o **Scopus** (www.scopus.com) e realize sua busca científica normalmente.
2. Na página de resultados, selecione as publicações desejadas e clique em **Export** (Exportar).
3. Selecione a opção **CSV** (importante para compatibilidade do parser).
4. No menu de seleção de metadados, **marque obrigatoriamente** as seguintes opções:
   *   *Citation information* (Informações de Citação - Autores, IDs, Título, Ano, Fonte, Volume, Citações, DOI);
   *   *Bibliographical information* (Informações Bibliográficas - Idioma, Tipo de Documento, ISSN, CODEN, etc);
   *   *Abstract & keywords* (Resumo e Palavras-chave - Palavras-chave do Autor e Indexadas);
   *   *Other information* (Outras Informações - **Include References / Incluir Referências**).
5. Clique em **Export** e baixe o arquivo `.csv`.

### Passo 2: Carregando os Dados no Scientia
1. Com a aplicação aberta, arraste o arquivo do Scopus CSV baixado diretamente para a área central tracejada (**Dropzone**) ou clique no botão **"Selecionar Arquivo CSV"** para localizar o arquivo em seu computador.
2. Se a sua base já contiver artigos carregados na memória ativa, o Scientia apresentará um diálogo interativo perguntando se deseja **MESCLAR** (combinar arquivos de buscas diferentes acumulando os artigos) ou **SUBSTITUIR** (limpar a base antiga e começar uma análise limpa). Clique na opção desejada.

### Passo 3: Navegando pelas Funcionalidades e Abas
Use o menu superior lateral e clique entre as abas para explorar as análises dinâmicas:
*   📊 **Dashboard**: Visualize painéis com KPIs em tempo real (Total de Artigos, Autores unificados, Soma de Citações e Janela Temporal) e os 8 gráficos estáticos autoajustáveis das publicações.
*   🌐 **Mapa de Redes**: Navegue pela representação estrutural da sua base científica. Escolha entre **Coocorrência de Termos** (Palavras-chave) ou **Coautoria (Co-authorship)**. Os nós do gráfico possuem simulação física de gravidade por molas:
    *   *Mova nós* clicando e arrastando-os com o cursor.
    *   *Dê zoom* utilizando o scroll (roda do mouse) sobre a tela do canvas.
    *   *Foque parceiros e relevância* passando o mouse (hover) em um nó específico.
*   📄 **Artigos / Autores / Palavras / Referências / Acesso**: Explore tabelas completas, interativas e paginadas com buscas internas focadas em cada entidade bibliométrica. Nessa seção, é possível verificar os rankings de autores mais citados e os periódicos de maior impacto de forma limpa.
*   🩺 **Placa de Integridade (Diagnóstico)**: Verifique o nível de qualidade dos metadados da sua base. O Scientia audita a ausência de abstracts, DOIs estruturados, idiomas catalogados e consistência nas referências.

### Passo 4: Sincronizando com o Supabase (Nuvem)
Para salvar seus dados com segurança de nível de produção e acessá-los de qualquer dispositivo:
1. Abra o painel lateral de **"Configurações / Conexão Banco"** clicando no ícone de engrenagem.
2. Insira a **URL do seu Projeto Supabase** e sua **Chave Pública (Anon Key)**.
3. Se você ainda não possui as tabelas criadas no banco, abra o arquivo SQL integrado no projeto e execute o comando DDL de criação estrutural das tabelas e views relacionais diretamente no **SQL Editor** do painel do Supabase.
4. Clique em **"Sincronizar com Supabase"**. A ferramenta irá dividir seus dados bibliométricos de forma procedural e realizar upserts paralelos em lotes para garantir integridade perfeita sem gerar custos pesados ou lentidão de conexão.


