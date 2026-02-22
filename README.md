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

- Linux (ou macOS/Windows com Python instalado)
- Python 3.10+ recomendado

## Estrutura do repositório

- `server.py`: servidor Flask e API
- `index.html`: página principal
- `app.js`: lógica do front-end
- `style.css`: estilos
- `data/db.json`: banco de dados local (criado automaticamente)
- `venv/`: ambiente virtual Python (criado por você)

## Como rodar (passo a passo)

A partir da pasta do projeto:

```bash
cd /home/jonathan/PycharmProjects/fluency_rush
```

### 1) Criar um ambiente isolado (venv)

```bash
python3 -m venv venv
```

### 2) Ativar a venv

```bash
source venv/bin/activate
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
