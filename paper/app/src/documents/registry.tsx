import type { ComponentType } from 'react';
import type { CaseDoc } from '../../../shared/case-types.ts';
import * as C from './components.tsx';
import { SquarePlan, TownMap, TowerSection } from '../maps/maps.tsx';
import { useDoc } from './context.tsx';

const REGISTRY: Record<string, ComponentType<Record<string, unknown>>> = {
  Cover: C.Cover,
  RulesCard: C.RulesCard,
  BriefingLetter: C.BriefingLetter,
  CipherDisk: C.CipherDisk,
  Protocol: C.Protocol,
  PhotoPrint: C.PhotoPrint,
  ExpertReport: C.ExpertReport,
  SpeedTable: C.SpeedTable,
  SpecSheet: C.SpecSheet,
  Clipping: C.Clipping,
  PhotoReport: C.PhotoReport,
  DossierCards: C.DossierCards,
  TaskSheet: C.TaskSheet,
  Transcript: C.Transcript,
  ForensicPhoto: C.ForensicPhoto,
  InterviewRecord: C.InterviewRecord,
  InventoryCard: C.InventoryCard,
  OfficialAct: C.OfficialAct,
  FingerprintReport: C.FingerprintReport,
  LogTable: C.LogTable,
  Letter: C.Letter,
  DraftAct: C.DraftAct,
  NotebookPage: C.NotebookPage,
  TownMap: () => <TownMap />,
  SquarePlan: () => <SquarePlan />,
  TowerSection: (p) => <TowerSection note={p.note as string} />,
};

function DocView({ doc }: { doc: CaseDoc }) {
  const { level } = useDoc();
  const Component = REGISTRY[doc.component];
  if (!Component) return <div className="doc">Невідомий тип документа: {doc.component}</div>;
  return <Component {...doc.props} {...(doc.levels?.[level] ?? {})} />;
}

/** Документ справи з урахуванням рівня (рівень береться з DocProvider). */
export function renderDoc(doc: CaseDoc) {
  return <DocView key={doc.id} doc={doc} />;
}

export const knownComponents = Object.keys(REGISTRY);
