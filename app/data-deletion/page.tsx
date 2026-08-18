import type { Metadata } from 'next'
import { LegalDocumentPage, type BilingualLegalSection } from '@/components/legal/legal-document-page'

export const metadata: Metadata = {
  title: 'Exclusão de dados | User Data Deletion | UP Zero',
  description: 'Instruções públicas, em português e inglês, para solicitar a exclusão de dados pessoais e de integrações da UP Zero.',
}

const sections: readonly BilingualLegalSection[] = [
  {
    titlePt: 'Como solicitar',
    titleEn: 'How to request deletion',
    paragraphsPt: ['Esta página fornece instruções para solicitar exclusão; ela não é um callback automatizado. Para iniciar o pedido:'],
    paragraphsEn: ['This page provides deletion request instructions; it is not an automated callback endpoint. To start a request:'],
    itemsPt: [
      'Acesse https://upzero.com.br/ e selecione o canal de Contato ou Suporte.',
      'Use o assunto “Exclusão de dados / Data deletion”.',
      'Informe nome completo, e-mail usado na conta e nome da empresa.',
      'Se aplicável, informe o Meta Business ID, WhatsApp Business Account ID ou número conectado que deseja remover.',
      'Descreva se deseja excluir apenas a integração da Meta/WhatsApp ou toda a conta e seus dados elegíveis.',
    ],
    itemsEn: [
      'Visit https://upzero.com.br/ and select the Contact or Support channel.',
      'Use the subject “Exclusão de dados / Data deletion”.',
      'Provide your full name, account email, and company name.',
      'If applicable, provide the Meta Business ID, WhatsApp Business Account ID, or connected phone number to be removed.',
      'State whether you want to delete only the Meta/WhatsApp integration or the entire account and its eligible data.',
    ],
  },
  {
    titlePt: 'Verificação de identidade e segurança',
    titleEn: 'Identity verification and security',
    paragraphsPt: [
      'Antes de excluir dados, poderemos solicitar confirmação pelo e-mail cadastrado ou evidência de que a pessoa solicitante está autorizada a representar a empresa e os ativos informados. Essa verificação protege a conta contra pedidos fraudulentos.',
      'Nunca envie senha, token de acesso, segredo do aplicativo, código de autenticação ou chave privada. A UP Zero não precisa desses segredos para validar uma solicitação de exclusão.',
    ],
    paragraphsEn: [
      'Before deleting data, we may request confirmation through the registered email or evidence that the requester is authorized to represent the business and identified assets. This verification protects the account from fraudulent requests.',
      'Never send a password, access token, app secret, authentication code, or private key. UP Zero does not need those secrets to validate a deletion request.',
    ],
  },
  {
    titlePt: 'Dados incluídos no pedido',
    titleEn: 'Data covered by the request',
    paragraphsPt: ['Conforme o escopo confirmado e as obrigações aplicáveis, a solicitação pode abranger:'],
    paragraphsEn: ['Depending on the confirmed scope and applicable obligations, the request may cover:'],
    itemsPt: [
      'Vínculos entre a conta UP Zero e ativos empresariais da Meta e do WhatsApp Business.',
      'Tokens e credenciais de integração mantidos pela UP Zero.',
      'Metadados de WABA e números de telefone, templates e configurações sincronizadas.',
      'Contatos, listas, consentimentos, campanhas, automações, conversas, mensagens e eventos associados à empresa.',
      'Dados de perfil e demais registros da conta que possam ser excluídos legal e tecnicamente.',
    ],
    itemsEn: [
      'Links between the UP Zero account and Meta and WhatsApp Business assets.',
      'Integration tokens and credentials held by UP Zero.',
      'WABA and phone number metadata, templates, and synchronized settings.',
      'Contacts, lists, consent records, campaigns, automations, conversations, messages, and events associated with the business.',
      'Profile data and other account records that can legally and technically be deleted.',
    ],
  },
  {
    titlePt: 'Desconexão na Meta',
    titleEn: 'Disconnecting on Meta',
    paragraphsPt: [
      'Você também pode remover a autorização do aplicativo nas configurações da conta ou das integrações empresariais da Meta. Isso interrompe acessos futuros concedidos por essa autorização, mas pode não eliminar dados já armazenados pela UP Zero. Para excluir esses registros, conclua a solicitação pelo canal oficial descrito nesta página.',
    ],
    paragraphsEn: [
      'You may also remove the app authorization in your Meta account or Business Integrations settings. This stops future access granted by that authorization but may not delete data already stored by UP Zero. To delete those records, complete the request through the official channel described on this page.',
    ],
  },
  {
    titlePt: 'Prazo, confirmação e retenções permitidas',
    titleEn: 'Timing, confirmation, and permitted retention',
    paragraphsPt: [
      'Após validar a identidade e o escopo, processaremos a solicitação e enviaremos uma confirmação ou atualização pelo canal informado, dentro do prazo exigido pela legislação aplicável.',
      'Alguns registros podem ser mantidos quando necessários ao cumprimento de obrigações legais, prevenção a fraude e segurança, cobrança, auditoria ou defesa de direitos. Nesses casos, o acesso será limitado e os dados serão eliminados ou anonimizados ao fim do período aplicável. Cópias em backup podem permanecer por ciclos limitados até sua substituição segura.',
    ],
    paragraphsEn: [
      'After validating identity and scope, we will process the request and send a confirmation or update through the provided channel within the period required by applicable law.',
      'Some records may be retained when needed for legal compliance, fraud prevention and security, billing, auditing, or legal claims. Access will be restricted, and the data will be deleted or anonymized when the applicable period ends. Backup copies may remain for limited cycles until securely overwritten.',
    ],
  },
  {
    titlePt: 'Solicitações de titulares e empresas',
    titleEn: 'Requests from individuals and businesses',
    paragraphsPt: [
      'Se você é uma pessoa que recebeu mensagens de uma empresa cliente da UP Zero, indique o número que enviou a mensagem, seu número de telefone e a empresa relacionada. A UP Zero avaliará se atua como controladora ou operadora e encaminhará a solicitação à parte responsável quando necessário.',
    ],
    paragraphsEn: [
      'If you are an individual who received messages from a business using UP Zero, identify the sending number, your phone number, and the related business. UP Zero will assess whether it acts as controller or processor and will route the request to the responsible party where necessary.',
    ],
  },
]

export default function DataDeletionPage() {
  return (
    <LegalDocumentPage
      currentPath="/data-deletion"
      titlePt="Exclusão de dados do usuário"
      titleEn="User Data Deletion"
      summaryPt="Estas instruções explicam como uma pessoa ou empresa pode solicitar a exclusão de dados mantidos pela UP Zero, inclusive dados relacionados ao Login da Meta e ao WhatsApp Business."
      summaryEn="These instructions explain how an individual or business can request deletion of data held by UP Zero, including data related to Meta Login and WhatsApp Business."
      calloutPt="Importante: remover o aplicativo nas configurações da Meta não substitui o pedido de exclusão dos dados já mantidos pela UP Zero. Use o canal oficial abaixo para concluir a solicitação."
      calloutEn="Important: removing the app from Meta settings does not replace a request to delete data already held by UP Zero. Use the official channel below to complete the request."
      sections={sections}
    />
  )
}
