<div align="center">

# 🎨 Advance CRM
### Sistema de Gestão Comercial, Licitações & Portais B2B

![Status](https://img.shields.io/badge/Status-Produção-24966b?style=for-the-badge&logoColor=white)
![Arquitetura](https://img.shields.io/badge/Arquitetura-Zero--Backend%20%2F%20Local--First-142d48?style=for-the-badge)
![Stack](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-315f91?style=for-the-badge)
![Licença](https://img.shields.io/badge/Licença-MIT-blue?style=for-the-badge)

*Desenvolvido por **Everton Nunes** para otimizar a operação comercial, prospecção industrial e gestão de editais e portais de compras da **Advance Tintas**.*

🌐 **[Acesse a aplicação online](https://evertonnunesc.github.io/advance-crm/)**

</div>

---

## 📑 Índice

* [💻 Layout & Telas](#-layout--telas)
* [🎯 O Problema Resolvido](#-o-problema-resolvido)
* [🚀 Principais Funcionalidades](#-principais-funcionalidades)
  * [1. Centro de Comando Geral (Dashboard)](#1-centro-de-comando-geral-dashboard)
  * [2. Pipeline de Oportunidades, Empresas & Contatos](#2-pipeline-de-oportunidades-empresas--contatos)
  * [3. Módulo Especializado Petronect](#3-módulo-especializado-petronect)
  * [4. Gestão de Portais & Homologação (Vendor List)](#4-gestão-de-portais--homologação-vendor-list)
  * [5. Tarefas e Rotina Comercial (To-Do)](#5-tarefas-e-rotina-comercial-to-do)
  * [6. Segurança, Controle de Acesso & Backup](#6-segurança-controle-de-acesso--backup)
* [🛠️ Arquitetura e Diferenciais Técnicos](#️-arquitetura-e-diferenciais-técnicos)
* [📄 Licença](#-licença)

---

## 💻 Layout & Telas

<p align="center">
  <img src="assets/img/login.png" alt="Tela de Login" width="48%">
  <img src="assets/img/inicio.png" alt="Dashboard Principal" width="48%">
</p>

---

## 🎯 O Problema Resolvido

Na rotina comercial B2B e de vendas para indústrias, construtoras e órgãos públicos, as informações costumam ficar fragmentadas entre planilhas soltas, anotações de prazos de licitação, credenciais de dezenas de portais de compras e controles de homologação (*Vendor List*).

O **Advance CRM** centraliza todo o ciclo comercial em uma única interface rápida, responsiva, com suporte a **Modo Claro/Escuro** e funcionamento **100% offline/local** (sem dependência de servidores externos ou mensalidades).

---

## 🚀 Principais Funcionalidades

### 1. Centro de Comando Geral (Dashboard)
- 📊 **KPIs em tempo real:** Oportunidades abertas, follow-ups atrasados, editais Petronect ativos, saúde dos portais e tarefas pendentes.
- 📅 **Agenda Unificada com Filtros:** Consolida prazos de oportunidades, vencimentos de editais, validade de cadastros em portais e tarefas do dia, com exportação direta de compromissos para o **Microsoft Outlook (`.ics`)**.
- 📈 **Funil Comercial:** Visualização gráfica do pipeline por etapa de negociação.

### 2. Pipeline de Oportunidades, Empresas & Contatos
- 🏢 **Cadastro inteligente:** Contas completas com máscara automática de CNPJ/telefone e autopreenchimento de dados da empresa.
- 📦 **Gestão de Propostas:** Múltiplos contatos e múltiplos itens/produtos por oportunidade, com cálculo automático do valor total.
- ✅ **Controle operacional:** Status comercial atualizado e checklist de conclusão de etapas.

### 3. Módulo Especializado Petronect
- 📋 **Dupla Visualização:** Alternância instantânea entre **Tabela** e **Quadro Kanban** com *Drag & Drop* (arrastar e soltar) entre etapas (*Analisando, Sala de Colaboração, Postada, Ganha, Perdida, Declinada*).
- 🧮 **Calculadora de Precificação Técnica:** Conversão de volume (Litros/Galões), aplicação de fator de ICMS, descontos comerciais, preço por litro e margem de lucro em tempo real.
- 📄 **Geração de Proposta em PDF:** Impressão formatada da proposta comercial diretamente pelo navegador.
- 🗓️ **Organização temporal:** Cálculo automático do trimestre (`Q1` a `Q4`) pela data de encerramento.

### 4. Gestão de Portais & Homologação (*Vendor List*)
- 🍩 **Painel Analítico:** Gráfico de rosca (*Donut Chart*) e barras de distribuição por status (*Ativo, Pendente, Em cadastro, Bloqueado, Atualização necessária, Vencido*).
- 🔑 **Cofre de Credenciais:** Armazenamento seguro de URLs, logins e senhas de portais de compras com botões de cópia rápida para a área de transferência.
- 🕒 **Histórico Auditável:** Registro cronológico de alterações cadastrais, trocas de senha, bloqueios e renovações.
- ⭐ **Acompanhamento de Vendor List:** Controle dedicado de etapas de homologação de fornecedores.

### 5. Tarefas e Rotina Comercial (To-Do)
- 📌 **Organização diária:** Gerenciamento de pendências internas e follow-ups vinculados a clientes, com alertas visuais de prazo vencido.

### 6. Segurança, Controle de Acesso & Backup
- 👥 **Autenticação Multi-usuário:** Perfis separados para **Administrador** e **Usuário Comercial**, com geração automática de senha inicial e troca obrigatória no primeiro acesso.
- 🛡️ **Trava de Segurança:** Exclusões de registros e restaurações de base exigem autenticação do Administrador.
- 💾 **Portabilidade Total de Dados:**
  - Exportação e restauração completa via **JSON**.
  - Exportação individual em **CSV** ou pacote completo compactado em **`.ZIP` nativo** (gerado via código puro em JavaScript, sem bibliotecas externas) contendo todas as bases separadas.

---

## 🛠️ Arquitetura e Diferenciais Técnicos

- ⚡ **Zero Dependências Externas:** Construído inteiramente com **HTML5, CSS3 (Custom Properties / Grid / Flexbox) e JavaScript Vanilla (ES6+)** em arquitetura *Single-File Application* modularizada.
- 📦 **Geração Binária Nativa:** Implementação própria de empacotamento **ZIP (CRC32 + Headers binários)** e geração de eventos **iCalendar (`.ics`)** no lado do cliente.
- 💾 **Persistência e Performance:** Armazenamento estruturado em `localStorage` com IDs sequenciais inteligentes por módulo e período (ex: `OP1120260001`, `PN1120260001`).
- 🎨 **UI/UX Adaptável:** Suporte nativo a **Dark Mode** e **Light Mode**, avatares personalizados com recorte automático via HTML5 Canvas e layout responsivo para desktop e mobile.

---

## 📄 Licença

Este projeto é de uso corporativo e exclusivo da **Advance Tintas**, desenvolvido por **Everton Nunes**.

<br>

<p align="center">
  <b>#B2B</b> · <b>#CommercialManagement</b> · <b>#Petronect</b> · <b>#Inovação</b> · <b>#Produtividade</b>
</p>
