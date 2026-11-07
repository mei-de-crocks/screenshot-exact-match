import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export function Field({label, children}: {label:string; children:ReactNode}) { return <label className="block space-y-2"><Label asChild><span>{label}</span></Label>{children}</label>; }
export function Choice({label,value,onChange,items}: {label:string;value:string;onChange:(v:string)=>void;items:{value:string;label:string}[]}) { return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="w-full"><SelectValue placeholder="Selecione…" /></SelectTrigger><SelectContent>{items.map(i=><SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent></Select></div>; }
export function Loading() { return <p className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="size-4 animate-spin"/>Carregando…</p>; }
export function ErrorNotice({text}: {text:string}) { return <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{text}</p>; }
export function GridTable({headers,children}: {headers:string[];children:ReactNode}) {return <div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{headers.map(h=><th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y">{children}</tbody></table></div>;}
export const cell = 'px-4 py-3';
export const tipos = [{value:'PROPRIETARIO',label:'Proprietário'},{value:'INQUILINO',label:'Inquilino'},{value:'DEPENDENTE',label:'Dependente'}];
export const statuses = ['ATIVO','INATIVO','BLOQUEADO'].map(value=>({value,label: value === 'ATIVO' ? 'Ativo' : value === 'INATIVO' ? 'Inativo' : 'Bloqueado'}));
