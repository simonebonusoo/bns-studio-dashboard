import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Eye, Plus, Share2, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { usePreview } from '@/components/preview/previewContext';
import { downloadPdf } from '@/services/documentService';
import { shareDocument } from '@/services/shareService';
import {
  BNS_QUOTE_LIMITS,
  BNS_QUOTE_PAGE,
  BNS_QUOTE_TEMPLATE_PAGES,
  bnsEstimatePdfBlob,
  bnsPdfCopyDefaults,
  formatBnsEuro,
  bnsPdfDefaults,
  bnsQuoteWarnings,
  normalizeBnsQuoteDocument,
  type BnsStudioQuoteCopy,
  type BnsStudioQuoteDocument,
} from '@/services/bnsEstimatePdf';
import { cn } from '@/lib/cn';
import type { Client, Estimate } from '@/types';

type FocusableField = HTMLInputElement | HTMLTextAreaElement;
type InlineEditorKind = 'single' | 'multi' | 'number';

const PreviewInlineEditorContext = createContext<{
  activeFieldId: string | null;
  activeValue: string;
  editorKindForField: (fieldId: string) => InlineEditorKind;
  startInlineEdit: (fieldId: string, currentText: string) => void;
  updateInlineEdit: (fieldId: string, nextValue: string) => void;
  finishInlineEdit: () => void;
} | null>(null);

function counterLabel(value: string, limit: number) {
  const safe = value?.length ?? 0;
  const danger = safe > limit;
  const warning = !danger && safe > limit * 0.85;
  return (
    <span className={cn('text-xs tabular-nums', danger ? 'text-danger' : warning ? 'text-warning' : 'text-fg-faint')}>
      {safe}/{limit}
    </span>
  );
}

function pageRect(x: number, y: number, w: number, h: number) {
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${w}px`,
    height: `${h}px`,
  };
}

function estimateWrappedLines(text: string, width: number, fontSize: number, charWidthFactor = 0.54) {
  const charsPerLine = Math.max(8, Math.floor(width / (fontSize * charWidthFactor)));
  return String(text || '')
    .split('\n')
    .reduce((sum, part) => sum + Math.max(1, Math.ceil(Math.max(1, part.length) / charsPerLine)), 0);
}

function estimateTextHeight(text: string, width: number, fontSize: number, lineHeight: number, minLines = 1) {
  return Math.max(minLines, estimateWrappedLines(text, width, fontSize)) * lineHeight;
}

function fieldRowId(fieldId: string) {
  if (fieldId.startsWith('cover.')) return 'page-cover';
  if (fieldId.startsWith('introduction.')) return 'page-intro';
  if (fieldId === 'copy.headerLabel') return 'page-intro';
  if (fieldId === 'copy.scopePageTitle') return 'page-scope';
  if (fieldId === 'copy.teamPageTitle' || fieldId === 'copy.teamPageSubtitle') return 'page-team';
  if (fieldId === 'copy.valuePageTitle' || fieldId === 'copy.valuePageSubtitle' || fieldId === 'copy.valueTotalLabel') return 'page-value';
  if (fieldId === 'copy.offerValueRealLabel' || fieldId === 'copy.offerReservedLabel') return 'page-offer';
  if (fieldId === 'copy.paymentPageTitle' || fieldId === 'copy.paymentTotalLabel') return 'page-payment';
  if (fieldId === 'copy.closingHeadline') return 'page-closing';
  if (fieldId.startsWith('scope.')) return 'page-scope';
  if (fieldId.startsWith('team.')) return 'page-team';
  if (fieldId.startsWith('valueBreakdown.')) return 'page-value';
  if (fieldId.startsWith('offer.')) return 'page-offer';
  if (fieldId.startsWith('payment.')) return 'page-payment';
  return 'page-cover';
}

function PageShell({ background, children }: { background: string; children: ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-border bg-white shadow-pop"
      style={{ width: `${BNS_QUOTE_PAGE.width}px`, height: `${BNS_QUOTE_PAGE.height}px` }}
    >
      <img src={background} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {children}
    </div>
  );
}

function WhiteMask({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <div className="absolute bg-white" style={pageRect(x, y, w, h)} />;
}

function TextBlock({
  x,
  y,
  w,
  h,
  text,
  fontFamily = 'BnsPoppins',
  fontSize,
  fontWeight = 500,
  lineHeight,
  italic,
  align = 'left',
  className,
  nowrap,
  fieldId,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  text: string;
  fontFamily?: string;
  fontSize: number;
  fontWeight?: number;
  lineHeight: number;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  nowrap?: boolean;
  fieldId?: string;
}) {
  const inlineEditor = useContext(PreviewInlineEditorContext);
  const editable = Boolean(fieldId && inlineEditor);
  const height = h ?? estimateTextHeight(text, w, fontSize, lineHeight);
  const isEditing = Boolean(fieldId && inlineEditor?.activeFieldId === fieldId);
  const editorKind = fieldId && inlineEditor ? inlineEditor.editorKindForField(fieldId) : 'single';

  return (
    <div
      className={cn(
        'absolute text-[#060606]',
        nowrap ? 'whitespace-nowrap' : 'whitespace-pre-wrap',
        editable && 'cursor-text rounded-md transition hover:bg-black/5',
        className,
      )}
      onDoubleClick={() => {
        if (editable && fieldId && inlineEditor) inlineEditor.startInlineEdit(fieldId, text);
      }}
      style={{
        ...pageRect(x, y, w, height),
        fontFamily,
        fontSize: `${fontSize}px`,
        fontWeight,
        lineHeight: `${lineHeight}px`,
        fontStyle: italic ? 'italic' : 'normal',
        textAlign: align,
      }}
      title={editable ? 'Doppio click per modificare questo contenuto' : undefined}
    >
      {isEditing && fieldId && inlineEditor ? (
        editorKind === 'multi' ? (
          <textarea
            autoFocus
            value={inlineEditor.activeValue}
            onChange={(event) => inlineEditor.updateInlineEdit(fieldId, event.target.value)}
            onBlur={inlineEditor.finishInlineEdit}
            className="absolute inset-0 resize-none rounded-md border border-[#060606]/30 bg-white/95 px-2 py-1 text-[#060606] shadow-sm outline-none"
            style={{
              fontFamily,
              fontSize: `${fontSize}px`,
              fontWeight,
              lineHeight: `${lineHeight}px`,
              fontStyle: italic ? 'italic' : 'normal',
              textAlign: align,
            }}
          />
        ) : (
          <input
            autoFocus
            type={editorKind === 'number' ? 'number' : 'text'}
            value={inlineEditor.activeValue}
            onChange={(event) => inlineEditor.updateInlineEdit(fieldId, event.target.value)}
            onBlur={inlineEditor.finishInlineEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                inlineEditor.finishInlineEdit();
              }
            }}
            className="absolute inset-0 rounded-md border border-[#060606]/30 bg-white/95 px-2 py-1 text-[#060606] shadow-sm outline-none"
            style={{
              fontFamily,
              fontSize: `${fontSize}px`,
              fontWeight,
              lineHeight: `${lineHeight}px`,
              fontStyle: italic ? 'italic' : 'normal',
              textAlign: align,
            }}
          />
        )
      ) : (
        text
      )}
    </div>
  );
}

function SectionCard({
  title,
  children,
  description,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description ? <p className="mt-1 text-xs text-fg-subtle">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function WarningPanel({ warnings }: { warnings: ReturnType<typeof bnsQuoteWarnings> }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-fg">Attenzione impaginazione</p>
          {warnings.map((warning) => (
            <p key={warning.id} className="text-xs text-fg-subtle">
              {warning.message}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageEditorRow({
  rowId,
  title,
  description,
  editor,
  preview,
  registerRow,
  showEditor,
}: {
  rowId: string;
  title: string;
  description: string;
  editor: ReactNode;
  preview: ReactNode;
  registerRow: (rowId: string) => (element: HTMLDivElement | null) => void;
  showEditor: boolean;
}) {
  return (
    <section ref={registerRow(rowId)} className="scroll-mt-6 rounded-[28px] border border-border bg-surface-2/30 p-4">
      <div className={cn('grid items-start gap-5', showEditor ? 'xl:grid-cols-[420px_minmax(0,1fr)]' : 'grid-cols-1')}>
        {showEditor ? (
          <div className="space-y-4 xl:sticky xl:top-4">
            <div>
              <h2 className="text-base font-semibold text-fg">{title}</h2>
              <p className="mt-1 text-sm text-fg-subtle">{description}</p>
            </div>
            {editor}
          </div>
        ) : null}
        <div className="rounded-3xl border border-border bg-surface-2/40 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-fg">Pagina di riferimento</h3>
              <p className="text-xs text-fg-subtle">Doppio click sul testo della preview per modificarlo direttamente sul documento.</p>
            </div>
          </div>
          <div className="overflow-x-auto">{preview}</div>
        </div>
      </div>
    </section>
  );
}

function QuotePageCover({
  document,
}: {
  document: BnsStudioQuoteDocument;
}) {
  return (
    <PageShell background={BNS_QUOTE_TEMPLATE_PAGES[0]}>
      <WhiteMask x={72} y={392} w={460} h={120} />
      <WhiteMask x={225} y={548} w={150} h={140} />
      <WhiteMask x={140} y={744} w={330} h={60} />
      <TextBlock x={88} y={420} w={420} text={document.cover.title} fontSize={30} fontWeight={900} lineHeight={34} align="center" fieldId="cover.title" />
      <TextBlock x={88} y={463} w={420} text={document.cover.subtitle} fontSize={19} fontWeight={500} lineHeight={24} align="center" fieldId="cover.subtitle" />
      <TextBlock x={140} y={768} w={320} text={document.cover.validityText} fontFamily="BnsLato" fontSize={12} fontWeight={400} lineHeight={14} italic align="center" fieldId="cover.validityText" />
    </PageShell>
  );
}

function QuotePageIntro({
  document,
  copy,
}: {
  document: BnsStudioQuoteDocument;
  copy: BnsStudioQuoteCopy;
}) {
  return (
    <PageShell background={BNS_QUOTE_TEMPLATE_PAGES[1]}>
      <WhiteMask x={470} y={36} w={102} h={18} />
      <WhiteMask x={236} y={780} w={124} h={46} />
      <WhiteMask x={54} y={70} w={500} h={664} />
      <TextBlock x={470} y={39} w={102} text={copy.headerLabel} fontFamily="BnsLato" fontSize={10} fontWeight={400} lineHeight={12} align="center" fieldId="copy.headerLabel" />
      <TextBlock x={273} y={801} w={50} text="Pag.01" fontFamily="BnsLato" fontSize={12} fontWeight={400} lineHeight={14} align="center" />
      <TextBlock x={58} y={114} w={280} text={document.introduction.aboutTitle} fontSize={26} fontWeight={900} lineHeight={30} fieldId="introduction.aboutTitle" />
      <TextBlock
        x={58}
        y={156}
        w={488}
        text={document.introduction.aboutBody}
        fontFamily="BnsLato"
        fontSize={16}
        fontWeight={400}
        lineHeight={24}
        fieldId="introduction.aboutBody"
      />
      <TextBlock x={58} y={376} w={488} text={document.introduction.objectiveTitle} fontSize={24} fontWeight={900} lineHeight={28} fieldId="introduction.objectiveTitle" />
      {document.introduction.objectiveBody.map((paragraph, index) => (
        <TextBlock
          key={`objective-${index}`}
          x={58}
          y={412 + index * 92}
          w={488}
          text={paragraph}
          fontFamily="BnsLato"
          fontSize={16}
          fontWeight={400}
          lineHeight={24}
          fieldId={`introduction.objectiveBody.${index}`}
        />
      ))}
    </PageShell>
  );
}

function QuotePageScope({
  document,
  copy,
}: {
  document: BnsStudioQuoteDocument;
  copy: BnsStudioQuoteCopy;
}) {
  return (
    <PageShell background={BNS_QUOTE_TEMPLATE_PAGES[2]}>
      <WhiteMask x={470} y={36} w={102} h={18} />
      <WhiteMask x={236} y={780} w={124} h={46} />
      <WhiteMask x={54} y={70} w={500} h={664} />
      <TextBlock x={470} y={39} w={102} text={copy.headerLabel} fontFamily="BnsLato" fontSize={10} fontWeight={400} lineHeight={12} align="center" fieldId="copy.headerLabel" />
      <TextBlock x={273} y={801} w={50} text="Pag.02" fontFamily="BnsLato" fontSize={12} fontWeight={400} lineHeight={14} align="center" />
      <TextBlock x={58} y={120} w={490} text={copy.scopePageTitle} fontSize={26} fontWeight={900} lineHeight={30} fieldId="copy.scopePageTitle" />
      <TextBlock x={58} y={155} w={490} text={document.scope.intro ?? ''} fontFamily="BnsLato" fontSize={15} fontWeight={400} lineHeight={19} fieldId="scope.intro" />
      {document.scope.items.map((item, index) => {
        const top = 230 + index * 96;
        return (
          <div key={item.id}>
            <TextBlock x={62} y={top} w={70} text={item.number} fontSize={26} fontWeight={900} lineHeight={30} />
            {index < document.scope.items.length - 1 ? (
              <div className="absolute w-px bg-[#242424]" style={pageRect(80, top + 24, 1, 40)} />
            ) : null}
            <TextBlock x={150} y={top - 16} w={360} text={item.title} fontSize={22} fontWeight={700} lineHeight={26} fieldId={`scope.items.${index}.title`} />
            <TextBlock x={150} y={top + 4} w={390} text={item.description} fontFamily="BnsLato" fontSize={15} fontWeight={400} lineHeight={19} fieldId={`scope.items.${index}.description`} />
          </div>
        );
      })}
    </PageShell>
  );
}

function QuotePageTeam({
  document,
  copy,
}: {
  document: BnsStudioQuoteDocument;
  copy: BnsStudioQuoteCopy;
}) {
  const memberLeft = document.team.members[0];
  const memberRight = document.team.members[1];
  const defaultCopy = bnsPdfCopyDefaults();
  const showCustomHeading = copy.teamPageTitle !== defaultCopy.teamPageTitle || copy.teamPageSubtitle !== defaultCopy.teamPageSubtitle;

  return (
    <PageShell background={BNS_QUOTE_TEMPLATE_PAGES[3]}>
      <WhiteMask x={470} y={36} w={102} h={18} />
      <WhiteMask x={236} y={780} w={124} h={46} />
      {showCustomHeading ? <WhiteMask x={54} y={92} w={500} h={100} /> : null}
      <WhiteMask x={56} y={488} w={214} h={276} />
      <WhiteMask x={324} y={488} w={214} h={276} />
      <TextBlock x={470} y={39} w={102} text={copy.headerLabel} fontFamily="BnsLato" fontSize={10} fontWeight={400} lineHeight={12} align="center" fieldId="copy.headerLabel" />
      <TextBlock x={273} y={801} w={50} text="Pag.03" fontFamily="BnsLato" fontSize={12} fontWeight={400} lineHeight={14} align="center" />
      <TextBlock
        x={58}
        y={120}
        w={490}
        text={copy.teamPageTitle}
        fontSize={26}
        fontWeight={900}
        lineHeight={30}
        fieldId="copy.teamPageTitle"
        className={showCustomHeading ? undefined : 'text-transparent'}
      />
      <TextBlock
        x={58}
        y={155}
        w={485}
        text={copy.teamPageSubtitle}
        fontFamily="BnsLato"
        fontSize={14}
        fontWeight={400}
        lineHeight={18}
        fieldId="copy.teamPageSubtitle"
        className={showCustomHeading ? undefined : 'text-transparent'}
      />
      {memberLeft?.visible !== false ? (
        <>
          <TextBlock x={58} y={526} w={210} text={memberLeft.name} fontSize={19} fontWeight={900} lineHeight={22} align="center" nowrap fieldId="team.members.0.name" />
          <TextBlock x={74} y={556} w={178} text={memberLeft.role} fontFamily="BnsLato" fontSize={11} fontWeight={400} lineHeight={13} italic align="center" nowrap fieldId="team.members.0.role" />
          {memberLeft.skills.map((skill, index) => (
            <TextBlock key={skill + index} x={78} y={592 + index * 19} w={172} text={`• ${skill}`} fontFamily="BnsLato" fontSize={13.5} fontWeight={400} lineHeight={18} fieldId={`team.members.0.skills.${index}`} />
          ))}
        </>
      ) : (
        <WhiteMask x={70} y={230} w={215} h={520} />
      )}
      {memberRight?.visible !== false ? (
        <>
          <TextBlock x={324} y={526} w={214} text={memberRight.name} fontSize={19} fontWeight={900} lineHeight={22} align="center" fieldId="team.members.1.name" />
          <TextBlock x={340} y={556} w={182} text={memberRight.role} fontFamily="BnsLato" fontSize={11} fontWeight={400} lineHeight={13} italic align="center" nowrap fieldId="team.members.1.role" />
          {memberRight.skills.map((skill, index) => (
            <TextBlock key={skill + index} x={346} y={592 + index * 19} w={172} text={`• ${skill}`} fontFamily="BnsLato" fontSize={13.5} fontWeight={400} lineHeight={18} fieldId={`team.members.1.skills.${index}`} />
          ))}
        </>
      ) : (
        <WhiteMask x={338} y={230} w={215} h={520} />
      )}
    </PageShell>
  );
}

function QuotePageValue({
  document,
  copy,
}: {
  document: BnsStudioQuoteDocument;
  copy: BnsStudioQuoteCopy;
}) {
  let currentY = 208;
  const layouts = document.valueBreakdown.sections.map((section) => {
    const titleHeight = estimateTextHeight(section.title, 320, 21, 24);
    const itemsStartY = currentY + titleHeight + 10;
    const itemsHeight = Math.max(18, section.items.length * 17);
    const layout = {
      section,
      top: currentY,
      titleHeight,
      itemsStartY,
      nextY: itemsStartY + itemsHeight + 30,
    };
    currentY = layout.nextY;
    return layout;
  });
  const totalY = Math.max(610, currentY + 20);

  return (
    <PageShell background={BNS_QUOTE_TEMPLATE_PAGES[4]}>
      <WhiteMask x={470} y={36} w={102} h={18} />
      <WhiteMask x={236} y={780} w={124} h={46} />
      <WhiteMask x={54} y={70} w={500} h={664} />
      <TextBlock x={470} y={39} w={102} text={copy.headerLabel} fontFamily="BnsLato" fontSize={10} fontWeight={400} lineHeight={12} align="center" fieldId="copy.headerLabel" />
      <TextBlock x={273} y={801} w={50} text="Pag.04" fontFamily="BnsLato" fontSize={12} fontWeight={400} lineHeight={14} align="center" />
      <TextBlock x={58} y={120} w={490} text={copy.valuePageTitle} fontSize={26} fontWeight={900} lineHeight={30} fieldId="copy.valuePageTitle" />
      <TextBlock x={58} y={154} w={490} text={copy.valuePageSubtitle} fontFamily="BnsLato" fontSize={14} fontWeight={400} lineHeight={18} fieldId="copy.valuePageSubtitle" />
      {layouts.map(({ section, top, titleHeight, itemsStartY }) => (
        <div key={section.id}>
          <TextBlock x={58} y={top} w={320} h={titleHeight} text={section.title} fontSize={21} fontWeight={700} lineHeight={24} fieldId={`valueBreakdown.sections.${section.id}.title`} />
          <div className="absolute border-t border-dashed border-[#2a2a2a]" style={pageRect(378, top + 12, 108, 1)} />
          <TextBlock x={452} y={top} w={100} text={formatBnsEuro(section.value, 0)} fontSize={22} fontWeight={700} lineHeight={24} align="right" nowrap fieldId={`valueBreakdown.sections.${section.id}.value`} />
          {section.items.map((item, itemIndex) => (
            <TextBlock
              key={`${section.id}-${itemIndex}`}
              x={54}
              y={itemsStartY + itemIndex * 17}
              w={260}
              text={`• ${item}`}
              fontFamily="BnsLato"
              fontSize={12.5}
              fontWeight={400}
              lineHeight={16}
              nowrap
              fieldId={`valueBreakdown.sections.${section.id}.items.${itemIndex}`}
            />
          ))}
        </div>
      ))}
      <TextBlock x={58} y={totalY} w={220} text={copy.valueTotalLabel} fontSize={22} fontWeight={900} lineHeight={24} fieldId="copy.valueTotalLabel" />
      <div className="absolute border-t border-dashed border-[#2a2a2a]" style={pageRect(254, totalY + 12, 232, 1)} />
      <TextBlock x={452} y={totalY} w={100} text={formatBnsEuro(document.valueBreakdown.totalRealValue, 0)} fontSize={22} fontWeight={900} lineHeight={24} align="right" nowrap />
    </PageShell>
  );
}

function QuotePageOffer({
  document,
  copy,
}: {
  document: BnsStudioQuoteDocument;
  copy: BnsStudioQuoteCopy;
}) {
  return (
    <PageShell background={BNS_QUOTE_TEMPLATE_PAGES[5]}>
      <WhiteMask x={470} y={36} w={102} h={18} />
      <WhiteMask x={236} y={780} w={124} h={46} />
      <WhiteMask x={24} y={120} w={548} h={620} />
      <WhiteMask x={58} y={70} w={482} h={664} />
      <TextBlock x={470} y={39} w={102} text={copy.headerLabel} fontFamily="BnsLato" fontSize={10} fontWeight={400} lineHeight={12} align="center" fieldId="copy.headerLabel" />
      <TextBlock x={273} y={801} w={50} text="Pag.05" fontFamily="BnsLato" fontSize={12} fontWeight={400} lineHeight={14} align="center" />
      <TextBlock x={108} y={154} w={380} text={document.offer.eyebrow} fontSize={20} fontWeight={700} lineHeight={24} align="center" fieldId="offer.eyebrow" />
      <TextBlock x={102} y={230} w={392} text={document.offer.headline} fontSize={31} fontWeight={900} lineHeight={36} align="center" fieldId="offer.headline" />
      <TextBlock x={112} y={318} w={372} text={document.offer.description} fontFamily="BnsLato" fontSize={16} fontWeight={400} lineHeight={21} align="center" fieldId="offer.description" />
      <TextBlock x={210} y={470} w={176} text={copy.offerValueRealLabel} fontSize={24} fontWeight={500} lineHeight={28} align="center" fieldId="copy.offerValueRealLabel" />
      <TextBlock x={190} y={505} w={220} text={formatBnsEuro(document.offer.realValue, 0)} fontSize={28} fontWeight={900} lineHeight={32} align="center" nowrap />
      <TextBlock x={150} y={632} w={296} text={copy.offerReservedLabel} fontSize={24} fontWeight={900} lineHeight={28} align="center" fieldId="copy.offerReservedLabel" />
      <TextBlock x={118} y={674} w={360} text={formatBnsEuro(document.offer.reservedPrice, 0)} fontSize={52} fontWeight={900} lineHeight={56} align="center" nowrap fieldId="offer.reservedPrice" />
      <div className="absolute bg-[#060606]" style={pageRect(175, 728, 245, 6)} />
      <TextBlock x={96} y={770} w={404} text={document.offer.footerText} fontFamily="BnsLato" fontSize={11.5} fontWeight={400} lineHeight={14} align="center" fieldId="offer.footerText" />
    </PageShell>
  );
}

function QuotePagePayment({
  document,
  copy,
}: {
  document: BnsStudioQuoteDocument;
  copy: BnsStudioQuoteCopy;
}) {
  return (
    <PageShell background={BNS_QUOTE_TEMPLATE_PAGES[6]}>
      <WhiteMask x={470} y={36} w={102} h={18} />
      <WhiteMask x={236} y={780} w={124} h={46} />
      <WhiteMask x={54} y={70} w={500} h={664} />
      <TextBlock x={470} y={39} w={102} text={copy.headerLabel} fontFamily="BnsLato" fontSize={10} fontWeight={400} lineHeight={12} align="center" fieldId="copy.headerLabel" />
      <TextBlock x={273} y={801} w={50} text="Pag.06" fontFamily="BnsLato" fontSize={12} fontWeight={400} lineHeight={14} align="center" />
      <TextBlock x={58} y={120} w={490} text={copy.paymentPageTitle} fontSize={26} fontWeight={900} lineHeight={30} fieldId="copy.paymentPageTitle" />
      <TextBlock x={58} y={154} w={485} text={document.payment.intro} fontFamily="BnsLato" fontSize={15} fontWeight={400} lineHeight={20} fieldId="payment.intro" />
      {document.payment.installments.map((installment, index) => {
        const top = 286 + index * 96;
        return (
          <div key={installment.id}>
            <TextBlock x={62} y={top} w={70} text={String(index + 1).padStart(2, '0')} fontSize={26} fontWeight={900} lineHeight={30} />
            <div className="absolute w-px bg-[#242424]" style={pageRect(80, top + 24, 1, 42)} />
            <TextBlock x={150} y={top - 14} w={320} text={installment.title} fontSize={21} fontWeight={700} lineHeight={24} fieldId={`payment.installments.${index}.title`} />
            <TextBlock x={150} y={top + 10} w={388} text={installment.description} fontFamily="BnsLato" fontSize={13.5} fontWeight={400} lineHeight={17} fieldId={`payment.installments.${index}.description`} />
            <TextBlock x={150} y={top + 50} w={140} text={formatBnsEuro(installment.amount, 2)} fontSize={17} fontWeight={700} lineHeight={20} nowrap fieldId={`payment.installments.${index}.amount`} />
          </div>
        );
      })}
      <TextBlock x={62} y={286 + document.payment.installments.length * 96} w={70} text="04" fontSize={26} fontWeight={900} lineHeight={30} />
      <TextBlock x={150} y={272 + document.payment.installments.length * 96} w={220} text={copy.paymentTotalLabel} fontSize={22} fontWeight={900} lineHeight={26} fieldId="copy.paymentTotalLabel" />
      <TextBlock x={150} y={298 + document.payment.installments.length * 96} w={160} text={formatBnsEuro(document.payment.total, 2)} fontSize={18} fontWeight={700} lineHeight={22} nowrap />
    </PageShell>
  );
}

function QuotePageClosing({ copy }: { copy: BnsStudioQuoteCopy }) {
  const defaultCopy = bnsPdfCopyDefaults();
  const showCustomHeadline = copy.closingHeadline !== defaultCopy.closingHeadline;

  return (
    <PageShell background={BNS_QUOTE_TEMPLATE_PAGES[7]}>
      {showCustomHeadline ? <WhiteMask x={214} y={354} w={176} h={56} /> : null}
      <TextBlock
        x={220}
        y={368}
        w={166}
        text={copy.closingHeadline}
        fontSize={28}
        fontWeight={900}
        lineHeight={32}
        align="center"
        fieldId="copy.closingHeadline"
        className={showCustomHeadline ? undefined : 'text-transparent'}
      />
    </PageShell>
  );
}

export function BnsPdfDialog({
  open,
  onClose,
  estimate,
  client,
}: {
  open: boolean;
  onClose: () => void;
  estimate: Estimate;
  client?: Client | null;
}) {
  const preview = usePreview();
  const fieldRefs = useRef<Record<string, FocusableField | null>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [draft, setDraft] = useState<BnsStudioQuoteDocument>(() => bnsPdfDefaults(estimate, client));
  const [copyDraft, setCopyDraft] = useState<BnsStudioQuoteCopy>(() => bnsPdfCopyDefaults(client));
  const [showSupportPanel, setShowSupportPanel] = useState(true);
  const [activeInlineFieldId, setActiveInlineFieldId] = useState<string | null>(null);
  const [activeInlineValue, setActiveInlineValue] = useState('');
  const [loadingAction, setLoadingAction] = useState<'preview' | 'download' | 'share' | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(bnsPdfDefaults(estimate, client));
      setCopyDraft(bnsPdfCopyDefaults(client));
      setActiveInlineFieldId(null);
      setActiveInlineValue('');
    }
  }, [open, estimate, client]);

  const document = useMemo(() => normalizeBnsQuoteDocument(draft), [draft]);
  const warnings = useMemo(() => bnsQuoteWarnings(draft), [draft]);
  const filename = `preventivo-bnsstudio-${estimate.number}.pdf`;

  const setDraftValue = (next: BnsStudioQuoteDocument | ((current: BnsStudioQuoteDocument) => BnsStudioQuoteDocument)) =>
    setDraft((current) => (typeof next === 'function' ? next(current) : next));

  const setCopyDraftValue = (next: BnsStudioQuoteCopy | ((current: BnsStudioQuoteCopy) => BnsStudioQuoteCopy)) =>
    setCopyDraft((current) => (typeof next === 'function' ? next(current) : next));

  const registerField = (fieldId: string) => (element: FocusableField | null) => {
    fieldRefs.current[fieldId] = element;
  };

  const registerRow = (rowId: string) => (element: HTMLDivElement | null) => {
    rowRefs.current[rowId] = element;
  };

  const editorKindForField = (fieldId: string): InlineEditorKind => {
    if (
      fieldId === 'introduction.aboutBody' ||
      fieldId === 'scope.intro' ||
      fieldId === 'copy.teamPageSubtitle' ||
      fieldId === 'copy.valuePageSubtitle' ||
      fieldId === 'offer.headline' ||
      fieldId === 'offer.description' ||
      fieldId === 'offer.footerText' ||
      fieldId === 'payment.intro'
    ) {
      return 'multi';
    }
    if (
      /^introduction\.objectiveBody\.\d+$/.test(fieldId) ||
      /^scope\.items\.\d+\.description$/.test(fieldId) ||
      /^payment\.installments\.\d+\.description$/.test(fieldId)
    ) {
      return 'multi';
    }
    if (
      fieldId === 'offer.reservedPrice' ||
      /^payment\.installments\.\d+\.amount$/.test(fieldId) ||
      /^valueBreakdown\.sections\.[^.]+\.value$/.test(fieldId)
    ) {
      return 'number';
    }
    return 'single';
  };

  const getFieldValue = (fieldId: string): string => {
    if (fieldId === 'cover.title') return draft.cover.title;
    if (fieldId === 'cover.subtitle') return draft.cover.subtitle;
    if (fieldId === 'cover.validityText') return draft.cover.validityText;
    if (fieldId === 'introduction.aboutTitle') return draft.introduction.aboutTitle;
    if (fieldId === 'introduction.aboutBody') return draft.introduction.aboutBody;
    if (fieldId === 'introduction.objectiveTitle') return draft.introduction.objectiveTitle;
    if (fieldId === 'scope.intro') return draft.scope.intro ?? '';
    if (fieldId === 'offer.eyebrow') return draft.offer.eyebrow;
    if (fieldId === 'offer.headline') return draft.offer.headline;
    if (fieldId === 'offer.description') return draft.offer.description;
    if (fieldId === 'offer.footerText') return draft.offer.footerText;
    if (fieldId === 'offer.reservedPrice') return String(draft.offer.reservedPrice);
    if (fieldId === 'payment.intro') return draft.payment.intro;
    if (fieldId === 'copy.headerLabel') return copyDraft.headerLabel;
    if (fieldId === 'copy.scopePageTitle') return copyDraft.scopePageTitle;
    if (fieldId === 'copy.teamPageTitle') return copyDraft.teamPageTitle;
    if (fieldId === 'copy.teamPageSubtitle') return copyDraft.teamPageSubtitle;
    if (fieldId === 'copy.valuePageTitle') return copyDraft.valuePageTitle;
    if (fieldId === 'copy.valuePageSubtitle') return copyDraft.valuePageSubtitle;
    if (fieldId === 'copy.valueTotalLabel') return copyDraft.valueTotalLabel;
    if (fieldId === 'copy.offerValueRealLabel') return copyDraft.offerValueRealLabel;
    if (fieldId === 'copy.offerReservedLabel') return copyDraft.offerReservedLabel;
    if (fieldId === 'copy.paymentPageTitle') return copyDraft.paymentPageTitle;
    if (fieldId === 'copy.paymentTotalLabel') return copyDraft.paymentTotalLabel;
    if (fieldId === 'copy.closingHeadline') return copyDraft.closingHeadline;

    const objectiveMatch = fieldId.match(/^introduction\.objectiveBody\.(\d+)$/);
    if (objectiveMatch) return draft.introduction.objectiveBody[Number(objectiveMatch[1])] ?? '';

    const scopeMatch = fieldId.match(/^scope\.items\.(\d+)\.(title|description)$/);
    if (scopeMatch) {
      const item = draft.scope.items[Number(scopeMatch[1])];
      return item ? String(item[scopeMatch[2] as 'title' | 'description'] ?? '') : '';
    }

    const teamTextMatch = fieldId.match(/^team\.members\.(\d+)\.(name|role)$/);
    if (teamTextMatch) {
      const member = draft.team.members[Number(teamTextMatch[1])];
      return member ? String(member[teamTextMatch[2] as 'name' | 'role'] ?? '') : '';
    }

    const teamSkillMatch = fieldId.match(/^team\.members\.(\d+)\.skills\.(\d+)$/);
    if (teamSkillMatch) {
      const member = draft.team.members[Number(teamSkillMatch[1])];
      return member?.skills[Number(teamSkillMatch[2])] ?? '';
    }

    const valueMatch = fieldId.match(/^valueBreakdown\.sections\.([^.]+)\.(title|value)$/);
    if (valueMatch) {
      const section = draft.valueBreakdown.sections.find((item) => item.id === valueMatch[1]);
      if (!section) return '';
      return valueMatch[2] === 'value' ? String(section.value) : section.title;
    }

    const valueItemMatch = fieldId.match(/^valueBreakdown\.sections\.([^.]+)\.items\.(\d+)$/);
    if (valueItemMatch) {
      const section = draft.valueBreakdown.sections.find((item) => item.id === valueItemMatch[1]);
      return section?.items[Number(valueItemMatch[2])] ?? '';
    }

    const installmentMatch = fieldId.match(/^payment\.installments\.(\d+)\.(title|description|amount)$/);
    if (installmentMatch) {
      const installment = draft.payment.installments[Number(installmentMatch[1])];
      if (!installment) return '';
      return installmentMatch[2] === 'amount'
        ? String(installment.amount)
        : String(installment[installmentMatch[2] as 'title' | 'description'] ?? '');
    }

    return '';
  };

  const setFieldValue = (fieldId: string, rawValue: string) => {
    const nextValue = editorKindForField(fieldId) === 'number' ? rawValue : rawValue;

    if (fieldId === 'cover.title') {
      setDraftValue((current) => ({ ...current, cover: { ...current.cover, title: nextValue } }));
      return;
    }
    if (fieldId === 'cover.subtitle') {
      setDraftValue((current) => ({ ...current, cover: { ...current.cover, subtitle: nextValue } }));
      return;
    }
    if (fieldId === 'cover.validityText') {
      setDraftValue((current) => ({ ...current, cover: { ...current.cover, validityText: nextValue } }));
      return;
    }
    if (fieldId === 'introduction.aboutTitle') {
      setDraftValue((current) => ({ ...current, introduction: { ...current.introduction, aboutTitle: nextValue } }));
      return;
    }
    if (fieldId === 'introduction.aboutBody') {
      setDraftValue((current) => ({ ...current, introduction: { ...current.introduction, aboutBody: nextValue } }));
      return;
    }
    if (fieldId === 'introduction.objectiveTitle') {
      setDraftValue((current) => ({ ...current, introduction: { ...current.introduction, objectiveTitle: nextValue } }));
      return;
    }
    if (fieldId === 'scope.intro') {
      setDraftValue((current) => ({ ...current, scope: { ...current.scope, intro: nextValue } }));
      return;
    }
    if (fieldId === 'offer.eyebrow') {
      setDraftValue((current) => ({ ...current, offer: { ...current.offer, eyebrow: nextValue } }));
      return;
    }
    if (fieldId === 'offer.headline') {
      setDraftValue((current) => ({ ...current, offer: { ...current.offer, headline: nextValue } }));
      return;
    }
    if (fieldId === 'offer.description') {
      setDraftValue((current) => ({ ...current, offer: { ...current.offer, description: nextValue } }));
      return;
    }
    if (fieldId === 'offer.footerText') {
      setDraftValue((current) => ({ ...current, offer: { ...current.offer, footerText: nextValue } }));
      return;
    }
    if (fieldId === 'offer.reservedPrice') {
      setDraftValue((current) => ({ ...current, offer: { ...current.offer, reservedPrice: Number(nextValue) || 0 } }));
      return;
    }
    if (fieldId === 'payment.intro') {
      setDraftValue((current) => ({ ...current, payment: { ...current.payment, intro: nextValue } }));
      return;
    }
    if (fieldId === 'copy.headerLabel') {
      setCopyDraftValue((current) => ({ ...current, headerLabel: nextValue }));
      return;
    }
    if (fieldId === 'copy.scopePageTitle') {
      setCopyDraftValue((current) => ({ ...current, scopePageTitle: nextValue }));
      return;
    }
    if (fieldId === 'copy.teamPageTitle') {
      setCopyDraftValue((current) => ({ ...current, teamPageTitle: nextValue }));
      return;
    }
    if (fieldId === 'copy.teamPageSubtitle') {
      setCopyDraftValue((current) => ({ ...current, teamPageSubtitle: nextValue }));
      return;
    }
    if (fieldId === 'copy.valuePageTitle') {
      setCopyDraftValue((current) => ({ ...current, valuePageTitle: nextValue }));
      return;
    }
    if (fieldId === 'copy.valuePageSubtitle') {
      setCopyDraftValue((current) => ({ ...current, valuePageSubtitle: nextValue }));
      return;
    }
    if (fieldId === 'copy.valueTotalLabel') {
      setCopyDraftValue((current) => ({ ...current, valueTotalLabel: nextValue }));
      return;
    }
    if (fieldId === 'copy.offerValueRealLabel') {
      setCopyDraftValue((current) => ({ ...current, offerValueRealLabel: nextValue }));
      return;
    }
    if (fieldId === 'copy.offerReservedLabel') {
      setCopyDraftValue((current) => ({ ...current, offerReservedLabel: nextValue }));
      return;
    }
    if (fieldId === 'copy.paymentPageTitle') {
      setCopyDraftValue((current) => ({ ...current, paymentPageTitle: nextValue }));
      return;
    }
    if (fieldId === 'copy.paymentTotalLabel') {
      setCopyDraftValue((current) => ({ ...current, paymentTotalLabel: nextValue }));
      return;
    }
    if (fieldId === 'copy.closingHeadline') {
      setCopyDraftValue((current) => ({ ...current, closingHeadline: nextValue }));
      return;
    }

    const objectiveMatch = fieldId.match(/^introduction\.objectiveBody\.(\d+)$/);
    if (objectiveMatch) {
      const index = Number(objectiveMatch[1]);
      setDraftValue((current) => ({
        ...current,
        introduction: {
          ...current.introduction,
          objectiveBody: current.introduction.objectiveBody.map((item, itemIndex) => (itemIndex === index ? nextValue : item)),
        },
      }));
      return;
    }

    const scopeMatch = fieldId.match(/^scope\.items\.(\d+)\.(title|description)$/);
    if (scopeMatch) {
      const index = Number(scopeMatch[1]);
      const key = scopeMatch[2] as 'title' | 'description';
      setDraftValue((current) => ({
        ...current,
        scope: {
          ...current.scope,
          items: current.scope.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: nextValue } : item)),
        },
      }));
      return;
    }

    const teamTextMatch = fieldId.match(/^team\.members\.(\d+)\.(name|role)$/);
    if (teamTextMatch) {
      const index = Number(teamTextMatch[1]);
      const key = teamTextMatch[2] as 'name' | 'role';
      setDraftValue((current) => ({
        ...current,
        team: {
          ...current.team,
          members: current.team.members.map((member, memberIndex) => (memberIndex === index ? { ...member, [key]: nextValue } : member)),
        },
      }));
      return;
    }

    const teamSkillMatch = fieldId.match(/^team\.members\.(\d+)\.skills\.(\d+)$/);
    if (teamSkillMatch) {
      const memberIndex = Number(teamSkillMatch[1]);
      const skillIndex = Number(teamSkillMatch[2]);
      setDraftValue((current) => ({
        ...current,
        team: {
          ...current.team,
          members: current.team.members.map((member, currentMemberIndex) =>
            currentMemberIndex === memberIndex
              ? {
                  ...member,
                  skills: member.skills.map((skill, currentSkillIndex) => (currentSkillIndex === skillIndex ? nextValue : skill)),
                }
              : member,
          ),
        },
      }));
      return;
    }

    const valueMatch = fieldId.match(/^valueBreakdown\.sections\.([^.]+)\.(title|value)$/);
    if (valueMatch) {
      const sectionId = valueMatch[1];
      const key = valueMatch[2];
      setDraftValue((current) => ({
        ...current,
        valueBreakdown: {
          ...current.valueBreakdown,
          sections: current.valueBreakdown.sections.map((section) =>
            section.id === sectionId
              ? {
                  ...section,
                  [key]: key === 'value' ? Number(nextValue) || 0 : nextValue,
                }
              : section,
          ),
        },
      }));
      return;
    }

    const valueItemMatch = fieldId.match(/^valueBreakdown\.sections\.([^.]+)\.items\.(\d+)$/);
    if (valueItemMatch) {
      const sectionId = valueItemMatch[1];
      const itemIndex = Number(valueItemMatch[2]);
      setDraftValue((current) => ({
        ...current,
        valueBreakdown: {
          ...current.valueBreakdown,
          sections: current.valueBreakdown.sections.map((section) =>
            section.id === sectionId
              ? {
                  ...section,
                  items: section.items.map((item, currentItemIndex) => (currentItemIndex === itemIndex ? nextValue : item)),
                }
              : section,
          ),
        },
      }));
      return;
    }

    const installmentMatch = fieldId.match(/^payment\.installments\.(\d+)\.(title|description|amount)$/);
    if (installmentMatch) {
      const installmentIndex = Number(installmentMatch[1]);
      const key = installmentMatch[2];
      setDraftValue((current) => ({
        ...current,
        payment: {
          ...current.payment,
          installments: current.payment.installments.map((installment, currentInstallmentIndex) =>
            currentInstallmentIndex === installmentIndex
              ? {
                  ...installment,
                  [key]: key === 'amount' ? Number(nextValue) || 0 : nextValue,
                }
              : installment,
          ),
        },
      }));
    }
  };

  const activateField = (fieldId: string) => {
    const rowId = fieldRowId(fieldId);
    rowRefs.current[rowId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveInlineFieldId(fieldId);
    setActiveInlineValue(getFieldValue(fieldId));
  };

  const finishInlineEdit = () => {
    if (!activeInlineFieldId) return;
    setFieldValue(activeInlineFieldId, activeInlineValue);
    setActiveInlineFieldId(null);
    setActiveInlineValue('');
  };

  const buildBlob = async () => bnsEstimatePdfBlob(estimate, client, document, copyDraft);

  const handlePreview = async () => {
    setLoadingAction('preview');
    try {
      const blob = await buildBlob();
      preview.open({ name: filename, blob, mime: 'application/pdf' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownload = async () => {
    setLoadingAction('download');
    try {
      await downloadPdf(filename, await buildBlob());
      onClose();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleShare = async () => {
    setLoadingAction('share');
    try {
      const blob = await buildBlob();
      await shareDocument({
        title: `Preventivo BNS Studio ${estimate.number}`,
        filename,
        blob,
        mime: 'application/pdf',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Preventivo BNS Studio"
      description="Editor live del documento: puoi modificare i testi direttamente sulla pagina con doppio click e usare il pannello laterale solo come supporto."
      size="full"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Chiudi
          </Button>
          <Button variant="secondary" onClick={handlePreview} loading={loadingAction === 'preview'}>
            <Eye className="h-4 w-4" /> Anteprima PDF
          </Button>
          <Button variant="secondary" onClick={handleShare} loading={loadingAction === 'share'}>
            <Share2 className="h-4 w-4" /> Condividi
          </Button>
          <Button onClick={handleDownload} loading={loadingAction === 'download'}>
            <Download className="h-4 w-4" /> Scarica PDF
          </Button>
        </>
      }
    >
      <PreviewInlineEditorContext.Provider
        value={{
          activeFieldId: activeInlineFieldId,
          activeValue: activeInlineValue,
          editorKindForField,
          startInlineEdit: (fieldId) => activateField(fieldId),
          updateInlineEdit: (_fieldId, nextValue) => setActiveInlineValue(nextValue),
          finishInlineEdit,
        }}
      >
        <div className="space-y-5 overflow-y-auto pr-1 xl:max-h-[calc(100dvh-12rem)]">
        <div className="rounded-3xl border border-border bg-surface-2/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-fg">Workflow di modifica</h3>
              <p className="text-sm text-fg-subtle">Scorri il documento per pagine: ogni testo puo essere modificato live nella preview e il pannello si puo aprire o nascondere quando vuoi.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowSupportPanel((current) => !current)}>
                {showSupportPanel ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {showSupportPanel ? 'Nascondi supporto' : 'Apri supporto'}
              </Button>
              <div className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-fg-subtle">
                {estimate.number}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <WarningPanel warnings={warnings} />
          </div>
        </div>

        <PageEditorRow
          rowId="page-cover"
          title="Pagina 1 · Cover"
          description="Titolo, sottotitolo e validita del preventivo."
          registerRow={registerRow}
          showEditor={showSupportPanel}
          editor={
            <SectionCard title="Cover" description="Mantiene la stessa gerarchia del master, con il simbolo K9 rimosso.">
              <Field label="Titolo" hint="Titolo principale della cover.">
                <div className="space-y-1">
                  <Input
                    ref={registerField('cover.title')}
                    maxLength={BNS_QUOTE_LIMITS.coverTitle}
                    value={draft.cover.title}
                    onChange={(event) => setDraftValue((current) => ({ ...current, cover: { ...current.cover, title: event.target.value } }))}
                  />
                  <div className="flex justify-end">{counterLabel(draft.cover.title, BNS_QUOTE_LIMITS.coverTitle)}</div>
                </div>
              </Field>
              <Field label="Sottotitolo">
                <div className="space-y-1">
                  <Input
                    ref={registerField('cover.subtitle')}
                    maxLength={BNS_QUOTE_LIMITS.coverSubtitle}
                    value={draft.cover.subtitle}
                    onChange={(event) => setDraftValue((current) => ({ ...current, cover: { ...current.cover, subtitle: event.target.value } }))}
                  />
                  <div className="flex justify-end">{counterLabel(draft.cover.subtitle, BNS_QUOTE_LIMITS.coverSubtitle)}</div>
                </div>
              </Field>
              <Field label="Validita">
                <div className="space-y-1">
                  <Input
                    ref={registerField('cover.validityText')}
                    maxLength={BNS_QUOTE_LIMITS.validityText}
                    value={draft.cover.validityText}
                    onChange={(event) => setDraftValue((current) => ({ ...current, cover: { ...current.cover, validityText: event.target.value } }))}
                  />
                  <div className="flex justify-end">{counterLabel(draft.cover.validityText, BNS_QUOTE_LIMITS.validityText)}</div>
                </div>
              </Field>
            </SectionCard>
          }
          preview={<QuotePageCover document={document} />}
        />

        <PageEditorRow
          rowId="page-intro"
          title="Pagina 2 · Chi Siamo + Obiettivo"
          description="Questa sezione segue la seconda pagina del documento."
          registerRow={registerRow}
          showEditor={showSupportPanel}
          editor={
            <SectionCard title="Chi Siamo + Obiettivo">
              <Field label="Header documento">
                <Input
                  ref={registerField('copy.headerLabel')}
                  value={copyDraft.headerLabel}
                  onChange={(event) => setCopyDraftValue((current) => ({ ...current, headerLabel: event.target.value }))}
                />
              </Field>
              <Field label="Titolo sezione Chi siamo">
                <Input
                  ref={registerField('introduction.aboutTitle')}
                  maxLength={BNS_QUOTE_LIMITS.aboutTitle}
                  value={draft.introduction.aboutTitle}
                  onChange={(event) =>
                    setDraftValue((current) => ({
                      ...current,
                      introduction: { ...current.introduction, aboutTitle: event.target.value },
                    }))
                  }
                />
              </Field>
              <Field label="Testo Chi siamo">
                <div className="space-y-1">
                  <Textarea
                    ref={registerField('introduction.aboutBody')}
                    maxLength={BNS_QUOTE_LIMITS.aboutBody}
                    value={draft.introduction.aboutBody}
                    onChange={(event) =>
                      setDraftValue((current) => ({
                        ...current,
                        introduction: { ...current.introduction, aboutBody: event.target.value },
                      }))
                    }
                  />
                  <div className="flex justify-end">{counterLabel(draft.introduction.aboutBody, BNS_QUOTE_LIMITS.aboutBody)}</div>
                </div>
              </Field>
              <Field label="Titolo obiettivo">
                <Input
                  ref={registerField('introduction.objectiveTitle')}
                  maxLength={BNS_QUOTE_LIMITS.objectiveTitle}
                  value={draft.introduction.objectiveTitle}
                  onChange={(event) =>
                    setDraftValue((current) => ({
                      ...current,
                      introduction: { ...current.introduction, objectiveTitle: event.target.value },
                    }))
                  }
                />
              </Field>
              {draft.introduction.objectiveBody.map((paragraph, index) => (
                <Field key={`objective-body-${index}`} label={`Paragrafo obiettivo ${index + 1}`}>
                  <div className="space-y-1">
                    <Textarea
                      ref={registerField(`introduction.objectiveBody.${index}`)}
                      maxLength={BNS_QUOTE_LIMITS.objectiveParagraphLength}
                      value={paragraph}
                      onChange={(event) =>
                        setDraftValue((current) => ({
                          ...current,
                          introduction: {
                            ...current.introduction,
                            objectiveBody: current.introduction.objectiveBody.map((item, itemIndex) =>
                              itemIndex === index ? event.target.value : item,
                            ),
                          },
                        }))
                      }
                    />
                    <div className="flex justify-end">{counterLabel(paragraph, BNS_QUOTE_LIMITS.objectiveParagraphLength)}</div>
                  </div>
                </Field>
              ))}
            </SectionCard>
          }
          preview={<QuotePageIntro document={document} copy={copyDraft} />}
        />

        <PageEditorRow
          rowId="page-scope"
          title="Pagina 3 · Cosa Comprende"
          description="Ogni voce resta accanto al blocco corretto della pagina."
          registerRow={registerRow}
          showEditor={showSupportPanel}
          editor={
            <SectionCard title="Cosa Comprende" description={`Massimo ${BNS_QUOTE_LIMITS.scopeItems} elementi per preservare l'impaginazione.`}>
              <Field label="Titolo pagina">
                <Input
                  ref={registerField('copy.scopePageTitle')}
                  value={copyDraft.scopePageTitle}
                  onChange={(event) => setCopyDraftValue((current) => ({ ...current, scopePageTitle: event.target.value }))}
                />
              </Field>
              <Field label="Sottotitolo introduttivo">
                <Input
                  ref={registerField('scope.intro')}
                  maxLength={BNS_QUOTE_LIMITS.scopeIntro}
                  value={draft.scope.intro ?? ''}
                  onChange={(event) =>
                    setDraftValue((current) => ({
                      ...current,
                      scope: { ...current.scope, intro: event.target.value },
                    }))
                  }
                />
              </Field>
              {draft.scope.items.map((item, index) => (
                <div key={item.id} className="space-y-2 rounded-2xl border border-border bg-surface-2/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-fg">Voce {item.number}</p>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() =>
                          setDraftValue((current) => {
                            const items = [...current.scope.items];
                            [items[index - 1], items[index]] = [items[index], items[index - 1]];
                            return { ...current, scope: { ...current.scope, items } };
                          })
                        }
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === draft.scope.items.length - 1}
                        onClick={() =>
                          setDraftValue((current) => {
                            const items = [...current.scope.items];
                            [items[index + 1], items[index]] = [items[index], items[index + 1]];
                            return { ...current, scope: { ...current.scope, items } };
                          })
                        }
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={draft.scope.items.length <= 1}
                        onClick={() =>
                          setDraftValue((current) => ({
                            ...current,
                            scope: { ...current.scope, items: current.scope.items.filter((_, itemIndex) => itemIndex !== index) },
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                  <Field label="Titolo">
                    <Input
                      ref={registerField(`scope.items.${index}.title`)}
                      maxLength={BNS_QUOTE_LIMITS.scopeTitle}
                      value={item.title}
                      onChange={(event) =>
                        setDraftValue((current) => ({
                          ...current,
                          scope: {
                            ...current.scope,
                            items: current.scope.items.map((currentItem, itemIndex) =>
                              itemIndex === index ? { ...currentItem, title: event.target.value } : currentItem,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Descrizione">
                    <Textarea
                      ref={registerField(`scope.items.${index}.description`)}
                      maxLength={BNS_QUOTE_LIMITS.scopeDescription}
                      value={item.description}
                      onChange={(event) =>
                        setDraftValue((current) => ({
                          ...current,
                          scope: {
                            ...current.scope,
                            items: current.scope.items.map((currentItem, itemIndex) =>
                              itemIndex === index ? { ...currentItem, description: event.target.value } : currentItem,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                </div>
              ))}
              <Button
                variant="secondary"
                disabled={draft.scope.items.length >= BNS_QUOTE_LIMITS.scopeItems}
                onClick={() =>
                  setDraftValue((current) => ({
                    ...current,
                    scope: {
                      ...current.scope,
                      items: [
                        ...current.scope.items,
                        {
                          id: crypto.randomUUID(),
                          number: String(current.scope.items.length + 1).padStart(2, '0'),
                          title: 'Nuova voce',
                          description: 'Descrizione della nuova voce.',
                        },
                      ],
                    },
                  }))
                }
              >
                <Plus className="h-4 w-4" /> Aggiungi voce
              </Button>
            </SectionCard>
          }
          preview={<QuotePageScope document={document} copy={copyDraft} />}
        />

        <PageEditorRow
          rowId="page-team"
          title="Pagina 4 · Team"
          description="Ho allargato i blocchi nomi/ruoli e abbassato la parte testuale per evitare tagli e sovrapposizioni."
          registerRow={registerRow}
          showEditor={showSupportPanel}
          editor={
            <SectionCard title="Team">
              <Field label="Titolo pagina">
                <Input
                  ref={registerField('copy.teamPageTitle')}
                  value={copyDraft.teamPageTitle}
                  onChange={(event) => setCopyDraftValue((current) => ({ ...current, teamPageTitle: event.target.value }))}
                />
              </Field>
              <Field label="Sottotitolo pagina">
                <Textarea
                  ref={registerField('copy.teamPageSubtitle')}
                  value={copyDraft.teamPageSubtitle}
                  onChange={(event) => setCopyDraftValue((current) => ({ ...current, teamPageSubtitle: event.target.value }))}
                />
              </Field>
              {draft.team.members.map((member, index) => (
                <div key={member.id} className="space-y-2 rounded-2xl border border-border bg-surface-2/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-fg">Membro {index + 1}</p>
                    <Button
                      variant={member.visible ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() =>
                        setDraftValue((current) => ({
                          ...current,
                          team: {
                            ...current.team,
                            members: current.team.members.map((currentMember, memberIndex) =>
                              memberIndex === index ? { ...currentMember, visible: !currentMember.visible } : currentMember,
                            ),
                          },
                        }))
                      }
                    >
                      {member.visible ? 'Visibile' : 'Nascosto'}
                    </Button>
                  </div>
                  <Field label="Nome">
                    <Input
                      ref={registerField(`team.members.${index}.name`)}
                      value={member.name}
                      onChange={(event) =>
                        setDraftValue((current) => ({
                          ...current,
                          team: {
                            ...current.team,
                            members: current.team.members.map((currentMember, memberIndex) =>
                              memberIndex === index ? { ...currentMember, name: event.target.value } : currentMember,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Ruolo">
                    <Input
                      ref={registerField(`team.members.${index}.role`)}
                      maxLength={BNS_QUOTE_LIMITS.teamRole}
                      value={member.role}
                      onChange={(event) =>
                        setDraftValue((current) => ({
                          ...current,
                          team: {
                            ...current.team,
                            members: current.team.members.map((currentMember, memberIndex) =>
                              memberIndex === index ? { ...currentMember, role: event.target.value } : currentMember,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                  {member.skills.map((skill, skillIndex) => (
                    <Field key={`${member.id}-skill-${skillIndex}`} label={`Competenza ${skillIndex + 1}`}>
                      <Input
                        ref={registerField(`team.members.${index}.skills.${skillIndex}`)}
                        maxLength={BNS_QUOTE_LIMITS.teamSkillLength}
                        value={skill}
                        onChange={(event) =>
                          setDraftValue((current) => ({
                            ...current,
                            team: {
                              ...current.team,
                              members: current.team.members.map((currentMember, memberIndex) =>
                                memberIndex === index
                                  ? {
                                      ...currentMember,
                                      skills: currentMember.skills.map((currentSkill, currentSkillIndex) =>
                                        currentSkillIndex === skillIndex ? event.target.value : currentSkill,
                                      ),
                                    }
                                  : currentMember,
                              ),
                            },
                          }))
                        }
                      />
                    </Field>
                  ))}
                </div>
              ))}
            </SectionCard>
          }
          preview={<QuotePageTeam document={document} copy={copyDraft} />}
        />

        <PageEditorRow
          rowId="page-value"
          title="Pagina 5 · Come Nasce Il Valore"
          description="La preview ora calcola l'altezza reale di titoli e bullet, quindi i blocchi non si sovrappongono piu quando un titolo va su due righe."
          registerRow={registerRow}
          showEditor={showSupportPanel}
          editor={
            <SectionCard title="Come Nasce Il Valore">
              <Field label="Titolo pagina">
                <Input
                  ref={registerField('copy.valuePageTitle')}
                  value={copyDraft.valuePageTitle}
                  onChange={(event) => setCopyDraftValue((current) => ({ ...current, valuePageTitle: event.target.value }))}
                />
              </Field>
              <Field label="Sottotitolo pagina">
                <Textarea
                  ref={registerField('copy.valuePageSubtitle')}
                  value={copyDraft.valuePageSubtitle}
                  onChange={(event) => setCopyDraftValue((current) => ({ ...current, valuePageSubtitle: event.target.value }))}
                />
              </Field>
              <Field label="Label totale">
                <Input
                  ref={registerField('copy.valueTotalLabel')}
                  value={copyDraft.valueTotalLabel}
                  onChange={(event) => setCopyDraftValue((current) => ({ ...current, valueTotalLabel: event.target.value }))}
                />
              </Field>
              {draft.valueBreakdown.sections.map((section, index) => (
                <div key={section.id} className="space-y-2 rounded-2xl border border-border bg-surface-2/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-fg">Area {index + 1}</p>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() =>
                          setDraftValue((current) => {
                            const sections = [...current.valueBreakdown.sections];
                            [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
                            return { ...current, valueBreakdown: { ...current.valueBreakdown, sections } };
                          })
                        }
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === draft.valueBreakdown.sections.length - 1}
                        onClick={() =>
                          setDraftValue((current) => {
                            const sections = [...current.valueBreakdown.sections];
                            [sections[index + 1], sections[index]] = [sections[index], sections[index + 1]];
                            return { ...current, valueBreakdown: { ...current.valueBreakdown, sections } };
                          })
                        }
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Field label="Titolo area">
                    <Input
                      ref={registerField(`valueBreakdown.sections.${section.id}.title`)}
                      maxLength={BNS_QUOTE_LIMITS.valueSectionTitle}
                      value={section.title}
                      onChange={(event) =>
                        setDraftValue((current) => ({
                          ...current,
                          valueBreakdown: {
                            ...current.valueBreakdown,
                            sections: current.valueBreakdown.sections.map((currentSection, sectionIndex) =>
                              sectionIndex === index ? { ...currentSection, title: event.target.value } : currentSection,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Valore">
                    <Input
                      ref={registerField(`valueBreakdown.sections.${section.id}.value`)}
                      type="number"
                      min={0}
                      step="0.01"
                      value={section.value}
                      onChange={(event) =>
                        setDraftValue((current) => ({
                          ...current,
                          valueBreakdown: {
                            ...current.valueBreakdown,
                            sections: current.valueBreakdown.sections.map((currentSection, sectionIndex) =>
                              sectionIndex === index ? { ...currentSection, value: Number(event.target.value) || 0 } : currentSection,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                  {section.items.map((item, itemIndex) => (
                    <Field key={`${section.id}-item-${itemIndex}`} label={`Bullet ${itemIndex + 1}`}>
                      <Input
                        ref={registerField(`valueBreakdown.sections.${section.id}.items.${itemIndex}`)}
                        maxLength={BNS_QUOTE_LIMITS.valueItemLength}
                        value={item}
                        onChange={(event) =>
                          setDraftValue((current) => ({
                            ...current,
                            valueBreakdown: {
                              ...current.valueBreakdown,
                              sections: current.valueBreakdown.sections.map((currentSection, sectionIndex) =>
                                sectionIndex === index
                                  ? {
                                      ...currentSection,
                                      items: currentSection.items.map((currentItem, currentItemIndex) =>
                                        currentItemIndex === itemIndex ? event.target.value : currentItem,
                                      ),
                                    }
                                  : currentSection,
                              ),
                            },
                          }))
                        }
                      />
                    </Field>
                  ))}
                </div>
              ))}
            </SectionCard>
          }
          preview={<QuotePageValue document={document} copy={copyDraft} />}
        />

        <PageEditorRow
          rowId="page-offer"
          title="Pagina 6 · Offerta Riservata"
          description="Contenuti e prezzo della pagina centrale dell'offerta."
          registerRow={registerRow}
          showEditor={showSupportPanel}
          editor={
            <SectionCard title="Offerta Riservata">
              <Field label="Eyebrow">
                <Input
                  ref={registerField('offer.eyebrow')}
                  value={draft.offer.eyebrow}
                  onChange={(event) => setDraftValue((current) => ({ ...current, offer: { ...current.offer, eyebrow: event.target.value } }))}
                />
              </Field>
              <Field label="Headline">
                <div className="space-y-1">
                  <Textarea
                    ref={registerField('offer.headline')}
                    maxLength={BNS_QUOTE_LIMITS.offerHeadline}
                    value={draft.offer.headline}
                    onChange={(event) => setDraftValue((current) => ({ ...current, offer: { ...current.offer, headline: event.target.value } }))}
                  />
                  <div className="flex justify-end">{counterLabel(draft.offer.headline, BNS_QUOTE_LIMITS.offerHeadline)}</div>
                </div>
              </Field>
              <Field label="Descrizione">
                <div className="space-y-1">
                  <Textarea
                    ref={registerField('offer.description')}
                    maxLength={BNS_QUOTE_LIMITS.offerDescription}
                    value={draft.offer.description}
                    onChange={(event) => setDraftValue((current) => ({ ...current, offer: { ...current.offer, description: event.target.value } }))}
                  />
                  <div className="flex justify-end">{counterLabel(draft.offer.description, BNS_QUOTE_LIMITS.offerDescription)}</div>
                </div>
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Valore reale">
                  <Input value={document.offer.realValue} disabled />
                </Field>
                <Field label="Label valore reale">
                  <Input
                    ref={registerField('copy.offerValueRealLabel')}
                    value={copyDraft.offerValueRealLabel}
                    onChange={(event) => setCopyDraftValue((current) => ({ ...current, offerValueRealLabel: event.target.value }))}
                  />
                </Field>
                <Field label="Prezzo riservato">
                  <Input
                    ref={registerField('offer.reservedPrice')}
                    type="number"
                    min={0}
                    max={document.offer.realValue}
                    step="0.01"
                    value={draft.offer.reservedPrice}
                    onChange={(event) =>
                      setDraftValue((current) => ({
                        ...current,
                        offer: {
                          ...current.offer,
                          reservedPrice: Math.min(Number(event.target.value) || 0, document.offer.realValue),
                        },
                      }))
                    }
                  />
                </Field>
                <Field label="Label prezzo riservato">
                  <Input
                    ref={registerField('copy.offerReservedLabel')}
                    value={copyDraft.offerReservedLabel}
                    onChange={(event) => setCopyDraftValue((current) => ({ ...current, offerReservedLabel: event.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Footer">
                <div className="space-y-1">
                  <Textarea
                    ref={registerField('offer.footerText')}
                    maxLength={BNS_QUOTE_LIMITS.offerFooterText}
                    value={draft.offer.footerText}
                    onChange={(event) => setDraftValue((current) => ({ ...current, offer: { ...current.offer, footerText: event.target.value } }))}
                  />
                  <div className="flex justify-end">{counterLabel(draft.offer.footerText, BNS_QUOTE_LIMITS.offerFooterText)}</div>
                </div>
              </Field>
            </SectionCard>
          }
          preview={<QuotePageOffer document={document} copy={copyDraft} />}
        />

        <PageEditorRow
          rowId="page-payment"
          title="Pagina 7 · Pagamento"
          description="Il piano rate resta vicino alla sua timeline di lettura."
          registerRow={registerRow}
          showEditor={showSupportPanel}
          editor={
            <SectionCard title="Pagamento">
              <Field label="Titolo pagina">
                <Input
                  ref={registerField('copy.paymentPageTitle')}
                  value={copyDraft.paymentPageTitle}
                  onChange={(event) => setCopyDraftValue((current) => ({ ...current, paymentPageTitle: event.target.value }))}
                />
              </Field>
              <Field label="Label totale">
                <Input
                  ref={registerField('copy.paymentTotalLabel')}
                  value={copyDraft.paymentTotalLabel}
                  onChange={(event) => setCopyDraftValue((current) => ({ ...current, paymentTotalLabel: event.target.value }))}
                />
              </Field>
              <Field label="Testo introduttivo">
                <div className="space-y-1">
                  <Textarea
                    ref={registerField('payment.intro')}
                    maxLength={BNS_QUOTE_LIMITS.paymentIntro}
                    value={draft.payment.intro}
                    onChange={(event) => setDraftValue((current) => ({ ...current, payment: { ...current.payment, intro: event.target.value } }))}
                  />
                  <div className="flex justify-end">{counterLabel(draft.payment.intro, BNS_QUOTE_LIMITS.paymentIntro)}</div>
                </div>
              </Field>
              {draft.payment.installments.map((installment, index) => (
                <div key={installment.id} className="space-y-2 rounded-2xl border border-border bg-surface-2/40 p-3">
                  <p className="text-sm font-semibold text-fg">Rata {index + 1}</p>
                  <Field label="Titolo">
                    <Input
                      ref={registerField(`payment.installments.${index}.title`)}
                      maxLength={BNS_QUOTE_LIMITS.paymentTitle}
                      value={installment.title}
                      onChange={(event) =>
                        setDraftValue((current) => ({
                          ...current,
                          payment: {
                            ...current.payment,
                            installments: current.payment.installments.map((currentInstallment, installmentIndex) =>
                              installmentIndex === index ? { ...currentInstallment, title: event.target.value } : currentInstallment,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Descrizione">
                    <Textarea
                      ref={registerField(`payment.installments.${index}.description`)}
                      maxLength={BNS_QUOTE_LIMITS.paymentDescription}
                      value={installment.description}
                      onChange={(event) =>
                        setDraftValue((current) => ({
                          ...current,
                          payment: {
                            ...current.payment,
                            installments: current.payment.installments.map((currentInstallment, installmentIndex) =>
                              installmentIndex === index ? { ...currentInstallment, description: event.target.value } : currentInstallment,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Importo">
                    <Input
                      ref={registerField(`payment.installments.${index}.amount`)}
                      type="number"
                      min={0}
                      step="0.01"
                      value={installment.amount}
                      onChange={(event) =>
                        setDraftValue((current) => ({
                          ...current,
                          payment: {
                            ...current.payment,
                            installments: current.payment.installments.map((currentInstallment, installmentIndex) =>
                              installmentIndex === index ? { ...currentInstallment, amount: Number(event.target.value) || 0 } : currentInstallment,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                </div>
              ))}
            </SectionCard>
          }
          preview={<QuotePagePayment document={document} copy={copyDraft} />}
        />

        <PageEditorRow
          rowId="page-closing"
          title="Pagina 8 · Finale"
          description="Chiusa finale del template, ora modificabile anche direttamente sulla pagina."
          registerRow={registerRow}
          showEditor={showSupportPanel}
          editor={
            <SectionCard title="Pagina finale" description="Il claim finale puo essere ritoccato senza alterare l'impaginazione del template.">
              <Field label="Headline finale">
                <Input
                  ref={registerField('copy.closingHeadline')}
                  value={copyDraft.closingHeadline}
                  onChange={(event) => setCopyDraftValue((current) => ({ ...current, closingHeadline: event.target.value }))}
                />
              </Field>
            </SectionCard>
          }
          preview={<QuotePageClosing copy={copyDraft} />}
        />
        </div>
      </PreviewInlineEditorContext.Provider>
    </Modal>
  );
}
