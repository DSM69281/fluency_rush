# Fluency Rush

Fluency Rush é um projeto simples (front-end estático + servidor Flask) para acompanhar usuários, pontuação (XP), feed de atividades e mensagens de chat em tempo real.

O servidor (`server.py`) expõe uma API HTTP e um endpoint de eventos (SSE) para atualizar a interface sem precisar recarregar a página.

## Principais características

- Interface web estática (HTML/CSS/JS)
- API em Flask
- Persistência local em arquivo JSON (`data/db.json`)
- Atualizações em tempo real via SSE (Server-Sent Events)
- Endpoints para:
  - usuários (`/api/users`)
  - XP (`/api/users/<user_id>/xp`)
  - feed (`/api/feed`)
  - chat (`/api/chat`)

## Requisitos

- Windows 10/11
- Python 3.10+ recomendado (com o Python adicionado ao PATH)

## Estrutura do repositório

- `server.py`: servidor Flask e API
- `index.html`: página principal
- `app.js`: lógica do front-end
- `style.css`: estilos
- `data/db.json`: banco de dados local (criado automaticamente)
- `venv/`: ambiente virtual Python (criado por você)

## Como rodar (passo a passo)

Abra o PowerShell ou o Prompt de Comando (cmd), navegue até a pasta do projeto e execute os passos abaixo.

### 1) Criar um ambiente isolado (venv)

```bash
python -m venv venv
```

### 2) Ativar a venv

PowerShell:

```bash
venv\Scripts\Activate.ps1
```

cmd:

```bash
venv\Scripts\activate.bat
```

Se a venv estiver ativa, seu terminal normalmente passa a mostrar `(venv)`.

### 3) Instalar dependências

```bash
pip install --upgrade pip
pip install flask flask-cors
```

### 4) Rodar o servidor

```bash
python server.py
```

O servidor sobe em:

- `http://127.0.0.1:5000/`

### 5) Abrir no navegador

Acesse:

- `http://127.0.0.1:5000/`

## Endpoints úteis

- `GET /`: abre a interface web
- `GET /events`: stream SSE para atualizações em tempo real
- `GET /api/users`: lista usuários
- `POST /api/users/<user_id>`: cria/atualiza usuário
- `PATCH /api/users/<user_id>/xp`: adiciona XP
- `GET /api/feed` e `POST /api/feed`: feed de atividades
- `GET /api/chat` e `POST /api/chat`: chat
- `POST /api/reset`: reseta o banco local

## Perguntas e conteúdo configuráveis (questions.json)

As perguntas do quiz e a lista de vocabulário podem ser configuradas no arquivo `questions.json`.

O frontend tenta carregar esse arquivo automaticamente ao fazer login. Se o arquivo não existir ou tiver erro de formato, o app usa um conteúdo padrão embutido no `app.js`.

### Onde fica

- `questions.json` (na raiz do repositório)

### Formato do arquivo

O arquivo possui três listas principais:

- `blitz`: perguntas de múltipla escolha
- `fill`: perguntas de completar a frase
- `vocab`: cartões de vocabulário

Campos esperados:

- `blitz[]`:
  - `id`: identificador
  - `q`: texto/HTML da pergunta
  - `opts`: lista de opções
  - `c`: índice (0-based) da opção correta
  - `explanation`: explicação curta (opcional)

- `fill[]`:
  - `id`: identificador
  - `q`: texto/HTML com o espaço em branco
  - `answer`: resposta correta
  - `hint`: dica

- `vocab[]`:
  - `w`: palavra
  - `p`: pronúncia
  - `m`: significado

### Como trocar as perguntas

1. Edite `questions.json`
2. Salve o arquivo
3. Recarregue a página no navegador

Para manter o app funcionando, garanta que `blitz` tenha pelo menos 1 pergunta e `fill` pelo menos 1 pergunta.

## Dicas e solução de problemas

### Porta 5000 já está em uso

Se aparecer `Address already in use`, significa que já existe algo rodando na porta 5000.

Opções:

- Pare o processo antigo (CTRL+C no terminal que está rodando o servidor)
- Ou altere a porta no final do `server.py` (parâmetro `port=...`)

### Onde fica o banco de dados

O arquivo é criado automaticamente em:

- `data/db.json`

Se você apagar esse arquivo, o servidor recria na próxima inicialização.
