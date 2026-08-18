import type { Metadata } from 'next'
import { LegalDocumentPage, type BilingualLegalSection } from '@/components/legal/legal-document-page'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Privacy Policy | UP Zero',
  description: 'Política de Privacidade da UP Zero em português e inglês para serviços integrados à Meta e ao WhatsApp Business.',
}

const sections: readonly BilingualLegalSection[] = [
  {
    titlePt: 'Quem somos e escopo',
    titleEn: 'Who we are and scope',
    paragraphsPt: [
      'A UP Zero, integrante do Grupo UP, fornece uma plataforma de comércio B2B e ferramentas de mensageria para empresas. Esta Política explica como tratamos dados pessoais quando uma empresa ou seu representante usa o Admin UP Zero, conecta ativos da Meta e do WhatsApp Business ou utiliza recursos de atendimento, templates, campanhas e automações.',
    ],
    paragraphsEn: [
      'UP Zero, part of Grupo UP, provides a B2B commerce platform and business messaging tools. This Policy explains how we process personal data when a company or its representative uses the UP Zero Admin, connects Meta and WhatsApp Business assets, or uses inbox, template, campaign, and automation features.',
    ],
  },
  {
    titlePt: 'Dados que podemos tratar',
    titleEn: 'Data we may process',
    paragraphsPt: ['Tratamos apenas os dados necessários para disponibilizar, proteger e melhorar os serviços contratados.'],
    paragraphsEn: ['We process only the data needed to provide, protect, and improve the contracted services.'],
    itemsPt: [
      'Dados de conta e perfil, como nome, e-mail, função, empresa e dados de autenticação.',
      'Identificadores e metadados autorizados da Meta, como Business Manager, WhatsApp Business Account, números de telefone, permissões concedidas e status da conexão.',
      'Templates, contatos, consentimentos (opt-in), listas, campanhas, automações e configurações criadas pela empresa usuária.',
      'Mensagens, respostas, status de entrega e eventos recebidos por webhooks quando necessários para atendimento, histórico e auditoria.',
      'Dados técnicos e de segurança, como endereço IP, navegador, data e hora, eventos operacionais, erros sanitizados e registros de auditoria.',
    ],
    itemsEn: [
      'Account and profile data, such as name, email, role, company, and authentication data.',
      'Authorized Meta identifiers and metadata, such as Business Manager, WhatsApp Business Account, phone numbers, granted permissions, and connection status.',
      'Templates, contacts, opt-in records, lists, campaigns, automations, and settings created by the business user.',
      'Messages, replies, delivery statuses, and webhook events when needed for support, history, and auditing.',
      'Technical and security data, such as IP address, browser, date and time, operational events, sanitized errors, and audit logs.',
    ],
  },
  {
    titlePt: 'Como usamos os dados',
    titleEn: 'How we use data',
    paragraphsPt: ['Usamos os dados para executar o serviço solicitado pela empresa, cumprir obrigações legais e regulatórias e proteger interesses legítimos relacionados à segurança e melhoria da plataforma.'],
    paragraphsEn: ['We use data to deliver the service requested by the business, comply with legal and regulatory obligations, and pursue legitimate interests related to platform security and improvement.'],
    itemsPt: [
      'Autenticar usuários e conectar ativos empresariais autorizados.',
      'Criar, consultar e gerenciar templates e enviar mensagens aprovadas conforme as regras da Meta e do WhatsApp.',
      'Receber mensagens e atualizações de status, organizar atendimentos e manter registros operacionais.',
      'Prevenir fraude, abuso e incidentes, diagnosticar falhas e prestar suporte.',
      'Cumprir a LGPD, ordens legais e demais obrigações aplicáveis.',
    ],
    itemsEn: [
      'Authenticate users and connect authorized business assets.',
      'Create, retrieve, and manage templates and send approved messages under Meta and WhatsApp rules.',
      'Receive messages and status updates, organize support interactions, and maintain operational records.',
      'Prevent fraud, abuse, and incidents, diagnose failures, and provide support.',
      'Comply with the Brazilian LGPD, lawful orders, and other applicable obligations.',
    ],
  },
  {
    titlePt: 'Compartilhamento e terceiros',
    titleEn: 'Sharing and third parties',
    paragraphsPt: [
      'Podemos compartilhar dados com a Meta e suas empresas para operar os recursos conectados; com fornecedores de infraestrutura, hospedagem, banco de dados, segurança e suporte contratados sob deveres de confidencialidade; e com autoridades quando houver obrigação legal. Não vendemos dados pessoais.',
      'O uso de produtos da Meta também está sujeito aos termos e políticas próprios da Meta e do WhatsApp. A empresa usuária deve assegurar base legal, transparência e consentimento quando exigidos para os contatos importados ou atendidos.',
    ],
    paragraphsEn: [
      'We may share data with Meta and its companies to operate connected features; with infrastructure, hosting, database, security, and support providers bound by confidentiality duties; and with authorities when legally required. We do not sell personal data.',
      'Use of Meta products is also subject to Meta and WhatsApp terms and policies. The business user must ensure a lawful basis, transparency, and consent where required for imported or contacted individuals.',
    ],
  },
  {
    titlePt: 'Armazenamento, segurança e retenção',
    titleEn: 'Storage, security, and retention',
    paragraphsPt: [
      'Adotamos medidas técnicas e organizacionais proporcionais aos riscos, incluindo controles de acesso, segregação por conta, proteção de credenciais e registros de auditoria. Nenhum sistema é totalmente imune a incidentes.',
      'Mantemos dados enquanto a conta ou integração estiver ativa e pelo período necessário às finalidades descritas, à segurança, à defesa de direitos e às obrigações legais. Depois disso, os dados são excluídos ou anonimizados de forma razoável, salvo retenção obrigatória.',
    ],
    paragraphsEn: [
      'We use technical and organizational safeguards appropriate to the risks, including access controls, account segregation, credential protection, and audit records. No system is completely immune to incidents.',
      'We retain data while the account or integration is active and for as long as needed for the purposes described, security, legal claims, and legal obligations. Data is then reasonably deleted or anonymized unless retention is required.',
    ],
  },
  {
    titlePt: 'Direitos e escolhas',
    titleEn: 'Rights and choices',
    paragraphsPt: [
      'Nos termos da legislação aplicável, a pessoa titular pode solicitar confirmação do tratamento, acesso, correção, portabilidade quando cabível, informação sobre compartilhamento, revisão de decisões automatizadas, oposição, revogação de consentimento e exclusão de dados tratados com base no consentimento, observadas as exceções legais.',
      'A desconexão da integração na Meta interrompe novos acessos, mas não exclui automaticamente todos os registros já mantidos pela UP Zero. Para eliminar esses registros, siga as instruções da página Exclusão de dados.',
    ],
    paragraphsEn: [
      'Under applicable law, a data subject may request confirmation of processing, access, correction, portability where applicable, information about sharing, review of automated decisions, objection, withdrawal of consent, and deletion of consent-based data, subject to legal exceptions.',
      'Disconnecting the Meta integration stops new access but may not automatically delete every record already held by UP Zero. To delete those records, follow the Data deletion page instructions.',
    ],
  },
  {
    titlePt: 'Transferências, menores e alterações',
    titleEn: 'Transfers, children, and changes',
    paragraphsPt: [
      'Fornecedores de tecnologia podem tratar dados em outros países, com medidas contratuais e de segurança apropriadas. Os serviços empresariais não são direcionados a crianças. Podemos atualizar esta Política para refletir mudanças legais, técnicas ou operacionais, indicando a data da versão vigente.',
    ],
    paragraphsEn: [
      'Technology providers may process data in other countries under appropriate contractual and security safeguards. The business services are not directed to children. We may update this Policy to reflect legal, technical, or operational changes and will identify the effective version date.',
    ],
  },
  {
    titlePt: 'Contato',
    titleEn: 'Contact',
    paragraphsPt: [
      'Para dúvidas, exercício de direitos ou solicitações de privacidade, use o canal oficial de Contato ou Suporte no site da UP Zero. Não envie senhas, tokens de acesso, segredos do aplicativo ou códigos de autenticação.',
    ],
    paragraphsEn: [
      'For questions, privacy rights, or requests, use the official Contact or Support channel on the UP Zero website. Do not send passwords, access tokens, app secrets, or authentication codes.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      currentPath="/privacy"
      titlePt="Política de Privacidade"
      titleEn="Privacy Policy"
      summaryPt="Esta Política descreve como a UP Zero coleta, usa, compartilha, protege, mantém e exclui dados pessoais nos serviços de comércio B2B e mensageria integrados à Meta e ao WhatsApp Business."
      summaryEn="This Policy describes how UP Zero collects, uses, shares, protects, retains, and deletes personal data in its B2B commerce and Meta and WhatsApp Business messaging services."
      sections={sections}
    />
  )
}
