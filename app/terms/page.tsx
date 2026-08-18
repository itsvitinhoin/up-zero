import type { Metadata } from 'next'
import { LegalDocumentPage, type BilingualLegalSection } from '@/components/legal/legal-document-page'

export const metadata: Metadata = {
  title: 'Termos de Uso | Terms of Service | UP Zero',
  description: 'Termos de Uso da UP Zero em português e inglês para a plataforma e integrações de mensageria empresarial.',
}

const sections: readonly BilingualLegalSection[] = [
  {
    titlePt: 'Aceitação e representação',
    titleEn: 'Acceptance and authority',
    paragraphsPt: [
      'Ao acessar ou utilizar a UP Zero, você concorda com estes Termos em nome próprio e, quando aplicável, da empresa que representa. Você declara ter capacidade e autorização para vincular essa empresa, seus ativos empresariais e seus usuários.',
    ],
    paragraphsEn: [
      'By accessing or using UP Zero, you agree to these Terms for yourself and, where applicable, for the business you represent. You confirm that you have the legal capacity and authority to bind that business, its business assets, and its users.',
    ],
  },
  {
    titlePt: 'Serviços',
    titleEn: 'Services',
    paragraphsPt: [
      'A UP Zero disponibiliza recursos de comércio B2B, administração, catálogo, atendimento e mensageria empresarial. Alguns recursos permitem conectar contas e ativos da Meta e do WhatsApp Business, gerenciar templates, contatos, campanhas, automações, mensagens e eventos de entrega.',
      'Funcionalidades, limites e disponibilidade podem variar conforme o plano, a configuração, o país, os provedores integrados e o estágio de desenvolvimento do produto.',
    ],
    paragraphsEn: [
      'UP Zero provides B2B commerce, administration, catalog, support, and business messaging features. Some features allow users to connect Meta and WhatsApp Business accounts and assets and manage templates, contacts, campaigns, automations, messages, and delivery events.',
      'Features, limits, and availability may vary by plan, configuration, country, integrated provider, and product development stage.',
    ],
  },
  {
    titlePt: 'Conta e segurança',
    titleEn: 'Account and security',
    paragraphsPt: ['A empresa usuária é responsável pela exatidão dos dados cadastrados, pelo controle de seus usuários e pela confidencialidade de credenciais.'],
    paragraphsEn: ['The business user is responsible for accurate account information, user access control, and credential confidentiality.'],
    itemsPt: [
      'Use contas individuais e permissões compatíveis com a função de cada usuário.',
      'Não compartilhe senhas, tokens, segredos do aplicativo ou códigos de autenticação.',
      'Comunique imediatamente suspeitas de acesso indevido ou comprometimento.',
      'Mantenha atualizadas as informações da empresa e dos ativos conectados.',
    ],
    itemsEn: [
      'Use individual accounts and role-appropriate permissions.',
      'Do not share passwords, tokens, app secrets, or authentication codes.',
      'Promptly report suspected unauthorized access or compromise.',
      'Keep company and connected asset information current.',
    ],
  },
  {
    titlePt: 'Uso permitido e obrigações de mensageria',
    titleEn: 'Acceptable use and messaging obligations',
    paragraphsPt: ['Você deve usar a plataforma de forma lícita, transparente e compatível com os direitos das pessoas destinatárias.'],
    paragraphsEn: ['You must use the platform lawfully, transparently, and consistently with recipients’ rights.'],
    itemsPt: [
      'Obtenha e registre consentimento ou outra base legal válida antes de enviar mensagens, quando exigido.',
      'Respeite pedidos de descadastro, preferências, janelas de atendimento, categorias e templates aprovados.',
      'Não envie spam, conteúdo enganoso, abusivo, discriminatório, ilegal ou que viole direitos de terceiros.',
      'Não tente contornar limites, revisões, bloqueios, políticas ou mecanismos de segurança da UP Zero, Meta ou WhatsApp.',
      'Mantenha provas e registros necessários para demonstrar conformidade.',
    ],
    itemsEn: [
      'Obtain and record consent or another valid lawful basis before messaging where required.',
      'Honor opt-outs, preferences, service windows, categories, and approved templates.',
      'Do not send spam or deceptive, abusive, discriminatory, unlawful, or infringing content.',
      'Do not circumvent limits, reviews, blocks, policies, or security controls of UP Zero, Meta, or WhatsApp.',
      'Maintain the evidence and records needed to demonstrate compliance.',
    ],
  },
  {
    titlePt: 'Serviços de terceiros',
    titleEn: 'Third-party services',
    paragraphsPt: [
      'Integrações dependem de serviços de terceiros, incluindo Meta e WhatsApp. O uso desses serviços também está sujeito aos termos, políticas, preços, limites, análises e decisões dos respectivos provedores. A UP Zero não controla aprovações de templates, qualidade de números, bloqueios, indisponibilidades ou alterações de APIs decididas por terceiros.',
    ],
    paragraphsEn: [
      'Integrations depend on third-party services, including Meta and WhatsApp. Use of those services is also subject to the providers’ terms, policies, pricing, limits, reviews, and decisions. UP Zero does not control template approvals, phone number quality, blocks, outages, or third-party API changes.',
    ],
  },
  {
    titlePt: 'Dados e conteúdo da empresa usuária',
    titleEn: 'Business user data and content',
    paragraphsPt: [
      'A empresa usuária mantém seus direitos sobre os dados e conteúdos enviados à plataforma e concede à UP Zero autorização limitada para tratá-los na medida necessária para operar, proteger e dar suporte ao serviço. A empresa é responsável pela origem, legalidade, qualidade e instruções de tratamento desses dados.',
      'A Política de Privacidade complementa estes Termos e explica o tratamento de dados pessoais pela UP Zero.',
    ],
    paragraphsEn: [
      'The business user retains its rights in data and content submitted to the platform and grants UP Zero a limited authorization to process them as needed to operate, protect, and support the service. The business is responsible for the source, lawfulness, quality, and processing instructions for that data.',
      'The Privacy Policy supplements these Terms and explains UP Zero’s processing of personal data.',
    ],
  },
  {
    titlePt: 'Disponibilidade, alterações e suspensão',
    titleEn: 'Availability, changes, and suspension',
    paragraphsPt: [
      'Podemos realizar manutenção, corrigir falhas, alterar recursos ou suspender acessos para proteger usuários e sistemas, cumprir a lei, responder a riscos ou violações e observar decisões de provedores integrados. Quando razoável, informaremos mudanças materiais pelos canais disponíveis.',
    ],
    paragraphsEn: [
      'We may perform maintenance, fix issues, change features, or suspend access to protect users and systems, comply with law, respond to risks or violations, and follow integrated provider decisions. Where reasonable, we will communicate material changes through available channels.',
    ],
  },
  {
    titlePt: 'Propriedade intelectual e responsabilidades',
    titleEn: 'Intellectual property and responsibilities',
    paragraphsPt: [
      'A plataforma, sua identidade, software e materiais pertencem à UP Zero ou a seus licenciadores. Estes Termos não transferem propriedade intelectual, exceto pelo direito limitado de usar o serviço durante a vigência da relação contratual.',
      'Na extensão permitida por lei, cada parte responde por seus próprios atos, obrigações e conteúdos. Eventuais limitações de responsabilidade e condições comerciais específicas podem constar da proposta, plano ou contrato firmado com a empresa usuária, sem afastar direitos que não possam ser legalmente limitados.',
    ],
    paragraphsEn: [
      'The platform, brand, software, and materials belong to UP Zero or its licensors. These Terms do not transfer intellectual property, except for the limited right to use the service during the contractual relationship.',
      'To the extent allowed by law, each party is responsible for its own acts, obligations, and content. Specific liability limits and commercial conditions may appear in the proposal, plan, or agreement with the business user, without limiting rights that cannot legally be waived.',
    ],
  },
  {
    titlePt: 'Encerramento, lei aplicável e contato',
    titleEn: 'Termination, governing law, and contact',
    paragraphsPt: [
      'A empresa pode deixar de usar os serviços e solicitar o encerramento de sua conta, observadas obrigações pendentes, retenções legais e as instruções de exclusão de dados. Estes Termos são interpretados conforme as leis do Brasil, respeitadas as normas obrigatórias aplicáveis.',
      'Para dúvidas sobre estes Termos, use o canal oficial de Contato ou Suporte no site da UP Zero.',
    ],
    paragraphsEn: [
      'A business may stop using the services and request account termination, subject to outstanding obligations, required retention, and the Data deletion instructions. These Terms are governed by the laws of Brazil, subject to applicable mandatory rules.',
      'For questions about these Terms, use the official Contact or Support channel on the UP Zero website.',
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalDocumentPage
      currentPath="/terms"
      titlePt="Termos de Uso"
      titleEn="Terms of Service"
      summaryPt="Estes Termos regem o acesso e o uso da plataforma UP Zero, inclusive recursos de comércio B2B e integrações empresariais com a Meta e o WhatsApp Business."
      summaryEn="These Terms govern access to and use of the UP Zero platform, including B2B commerce features and business integrations with Meta and WhatsApp Business."
      sections={sections}
    />
  )
}
