# Scopus Base Manager

Aplicacao web para importar arquivos CSV exportados do Scopus, normalizar os dados em um banco Supabase/Postgres e explorar artigos, autores, palavras-chave e referencias em uma interface pesquisavel.

O projeto foi pensado para quem baixa uma base bibliografica no Scopus e quer transformar o CSV em tabelas relacionais, com vinculos entre artigos, autores, termos, referencias e tipos de acesso aberto.

## O Que O Projeto Faz

- Le CSVs exportados do Scopus diretamente pelo navegador.
- Reconhece campos comuns como titulo, ano, DOI, autores, palavras-chave, referencias, citacoes e tipos de acesso aberto.
- Normaliza os dados nas tabelas `artigo`, `autor`, `palavra_chave`, `referencia` e tabelas de relacionamento.
- Permite explorar a base por artigos, autores, palavras-chave e referencias.
- Mostra detalhes do artigo, resumo, fonte, identificadores, autores e termos associados.
- Usa Supabase/Postgres como backend de dados.

## Stack

- SvelteKit
- Svelte 5
- TypeScript
- Tailwind CSS
- Supabase JS
- Postgres com `pg_trgm`, `unaccent`, RLS, indices e view consolidada
- PapaParse para leitura de CSV

## Como Preparar O Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode o arquivo [`supabase_setup.sql`](./supabase_setup.sql).
4. Copie a URL e a publishable/anon key do projeto.
5. Crie um `.env.local` baseado em `.env.example`:

```bash
VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
VITE_SUPABASE_KEY="sua-chave-publica"
```

O setup cria extensoes, tabelas, indices, trigger de busca, view `vw_artigos_completos`, policies publicas e uma estrutura opcional de staging/RPC para importacoes em lote.

Para uma reinstalacao limpa, limpe as tabelas manualmente no Supabase antes de rodar uma nova carga. O setup principal nao executa `TRUNCATE` para evitar perda acidental de dados.

## Rodando Localmente

```bash
npm install
npm run dev
```

Build de producao:

```bash
npm run build
```

Preview local do build:

```bash
npm run preview
```

Checagem Svelte/TypeScript:

```bash
npm run check
```

## Formato Esperado Do CSV Do Scopus

O importador aceita CSVs combinados exportados do Scopus. Os nomes abaixo sao os principais campos reconhecidos:

| Campo do CSV | Destino | Observacao |
| --- | --- | --- |
| `Scopus ID` ou `EID` | `artigo.scopus_id` | Usado para deduplicar artigos. |
| `Title` | `artigo.titulo` | Campo obrigatorio para identificar o artigo. |
| `Year` | `artigo.ano` | Validado no banco pelo intervalo permitido. |
| `Source title` ou `Source` | `artigo.source_title`, `artigo.source` | Revista, evento ou origem. |
| `Cited by` | `artigo.cited_by` | Numero de citacoes. |
| `DOI` ou `Doi` | `artigo.doi` | Normalizado em `doi_normalizado`. |
| `Link` ou `URL` | `artigo.link` | Link externo para publicacao. |
| `Abstract` | `artigo.resumo` | Texto usado tambem no vetor de busca. |
| `ISSN`, `ISBN`, `CODEN` | `artigo` | Identificadores bibliograficos. |
| `Language of Original Document` ou `Language` | `artigo.linguagem` | Idioma do documento. |
| `Document Type` | `artigo.document_type` | Tipo do documento. |
| `Author(s) ID` | `autor.id` e `artigo_autor` | IDs do Scopus separados por `;`, `|` ou `,`. |
| `Author full names` | `autor.nome_completo` | Usado para preencher nomes completos quando disponivel. |
| `Authors` | `autor.nome` | Fallback para autores. |
| `Author Keywords` | `palavra_chave` tipo `author` | Termos separados por `;` ou `|`. |
| `Index Keywords` | `palavra_chave` tipo `index` | Termos de indexacao. |
| `References` | `referencia` e `artigo_referencia` | Referencias brutas; o importer tenta extrair `titulo`, `ano` e `doi`. |
| `Open Access` | `open_access_tipo` e `artigo_open_access` | Tipos como `All Open Access`, `Gold Open Access`, `Green Open Access`, `Hybrid Gold Open Access` e `Bronze Open Access`. |

## Modelo De Dados

Tabelas principais:

- `artigo`: publicacoes importadas, com metadados, DOI, citacoes, fonte e vetor de busca.
- `autor`: autores identificados pelo Scopus Author ID.
- `palavra_chave`: termos de autor e termos indexados.
- `referencia`: referencias brutas extraidas do campo `References`, com enriquecimento por melhor esforco para `titulo`, `ano` e `doi`.
- `open_access_tipo`: tipos de acesso aberto.

Relacionamentos:

- `artigo_autor`: vincula artigos e autores.
- `artigo_palavra_chave`: vincula artigos e palavras-chave.
- `artigo_referencia`: vincula artigos e referencias citadas.
- `artigo_open_access`: vincula artigos e tipos de acesso aberto.

View de leitura:

- `vw_artigos_completos`: agrega artigos com arrays de autores, palavras-chave e tipos de acesso aberto para consumo pela interface.

## Fluxo De Uso

1. Exporte a base no Scopus em formato CSV.
2. Abra o Scopus Base Manager.
3. Clique em **Importar CSV**.
4. Solte ou selecione um ou mais arquivos `.csv`.
5. Aguarde a leitura, normalizacao e gravacao no Supabase.
6. Explore a base por artigos, autores, palavras-chave e referencias.

## Reimportando Apos Atualizar O Importer

Se sua base foi importada antes do suporte completo a referencias e Open Access, as tabelas `artigo_referencia`, `open_access_tipo` e `artigo_open_access` podem estar vazias. A forma mais previsivel de corrigir e:

1. Rode o `supabase_setup.sql` atualizado no Supabase.
2. Limpe os dados antigos ou, no minimo, limpe os vinculos derivados.
3. Reimporte o CSV original pelo app.

Para uma limpeza completa da base antes de uma nova carga, use com cuidado:

```sql
TRUNCATE TABLE
  artigo_open_access,
  artigo_referencia,
  artigo_palavra_chave,
  artigo_autor,
  open_access_tipo,
  referencia,
  palavra_chave,
  autor,
  artigo
RESTART IDENTITY CASCADE;
```

Se preferir preservar artigos e autores, limpe apenas os dados derivados que serao reconstruidos pela reimportacao:

```sql
TRUNCATE TABLE
  artigo_open_access,
  artigo_referencia,
  open_access_tipo
RESTART IDENTITY CASCADE;
```

## Estrutura Do Projeto

```text
src/
  lib/
    components/       Componentes Svelte da interface
    db.ts             Cliente Supabase
    importer.ts       Parser e normalizador do CSV
  routes/+page.svelte Tela principal
supabase_setup.sql    Setup completo do banco
process_staging_data.sql Nota de compatibilidade da RPC
```

## Variaveis De Ambiente

| Variavel | Descricao |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase. |
| `VITE_SUPABASE_KEY` | Chave publica publishable/anon usada pelo frontend. |

## Deploy

O projeto usa `@sveltejs/adapter-static`. Em producao, o `base path` configurado em `svelte.config.js` e:

```text
/scopus-base-manager
```

Se o deploy for feito na raiz do dominio, remova ou ajuste esse `base`.

## Limitações Conhecidas

- O app atual faz parsing e normalizacao no navegador antes de gravar no Supabase.
- A RPC `process_staging_data` fica disponivel no SQL para fluxos de staging/bulk import, mas a tela atual usa insercoes diretas via Supabase JS.
- Referencias dependem da qualidade do campo `References` exportado pelo Scopus. O CSV coloca todas as referencias em uma celula e tambem usa `;` dentro da lista de autores, entao a separacao e heuristica.
- A extracao de `ano` e `doi` das referencias tende a ser mais confiavel que a extracao de `titulo`.
- A policy publica atual facilita testes e demos, mas deve ser revisada antes de usar com dados sensiveis ou em ambiente multiusuario.
