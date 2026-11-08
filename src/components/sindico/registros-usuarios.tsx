import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { podeAlterarPapel, erroDados } from '@/lib/sindico-validation';
import { Choice, Field, Loading, ErrorNotice, GridTable, cell } from './common';
export function HistoricoTab() {
 const [inicio,setInicio]=useState('');const [fim,setFim]=useState('');const [pessoa,setPessoa]=useState('todos');const [fluxo,setFluxo]=useState('todos');const [page,setPage]=useState(0);const size=20;
 const invalid=!!inicio&&!!fim&&inicio>fim;
 const query=useQuery({queryKey:['sindico','historico',inicio,fim,pessoa,fluxo,page],enabled:!invalid,queryFn:async()=>{
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);
  let q=supabase.from('registros_acesso').select('*, moradores!registros_acesso_morador_id_fkey(nome, apartamentos(bloco,numero)), apartamentos(bloco,numero)',{count:'exact'}).gte('data_hora',cutoff.toISOString());
  if(inicio)q=q.gte('data_hora',new Date(`${inicio}T00:00:00`).toISOString());
  if(fim){const end=new Date(`${fim}T00:00:00`);end.setDate(end.getDate()+1);q=q.lt('data_hora',end.toISOString());}
  if(pessoa==='MORADOR'||pessoa==='VISITANTE'||pessoa==='PRESTADOR')q=q.eq('tipo_pessoa',pessoa);
  if(fluxo==='ENTRADA'||fluxo==='SAIDA')q=q.eq('tipo_fluxo',fluxo);
  const {data,error,count}=await q.order('data_hora',{ascending:false}).order('id').range(page*size,page*size+size-1);if(error)throw error;return {rows:data,count:count??0};
 }});
 return <section className="space-y-5"><h2 className="text-lg font-semibold">Histórico dos últimos 30 dias</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Data inicial"><Input type="date" value={inicio} onChange={e=>{setInicio(e.target.value);setPage(0);}}/></Field><Field label="Data final"><Input type="date" value={fim} onChange={e=>{setFim(e.target.value);setPage(0);}}/></Field><Choice label="Pessoa" value={pessoa} onChange={v=>{setPessoa(v);setPage(0);}} items={[{value:'todos',label:'Todas'},{value:'MORADOR',label:'Morador'},{value:'VISITANTE',label:'Visitante'},{value:'PRESTADOR',label:'Prestador'}]}/><Choice label="Fluxo" value={fluxo} onChange={v=>{setFluxo(v);setPage(0);}} items={[{value:'todos',label:'Todos'},{value:'ENTRADA',label:'Entrada'},{value:'SAIDA',label:'Saída'}]}/></div>
 {invalid?<ErrorNotice text="A data final não pode ser anterior à data inicial."/>:query.isLoading?<Loading/>:query.isError?<ErrorNotice text="Não foi possível carregar o histórico."/>:<><GridTable headers={['Data e hora','Nome','Pessoa','Apartamento','Fluxo']}>{query.data?.rows.map(r=>{const apartment=r.apartamentos??r.moradores?.apartamentos;return <tr key={r.id}><td className={`${cell} whitespace-nowrap`}>{new Date(r.data_hora).toLocaleString('pt-BR')}</td><td className={cell}>{r.moradores?.nome??r.nome_visitante??'—'}</td><td className={cell}>{r.tipo_pessoa==='MORADOR'?'Morador':r.tipo_pessoa==='VISITANTE'?'Visitante':'Prestador'}</td><td className={cell}>{apartment?`${apartment.bloco} / ${apartment.numero}`:'—'}</td><td className={cell}>{r.tipo_fluxo==='ENTRADA'?'Entrada':'Saída'}</td></tr>;})}</GridTable>{!query.data?.rows.length&&<p className="text-muted-foreground">Nenhum registro encontrado.</p>}<div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{query.data?.count??0} registros · Página {page+1} de {Math.max(1,Math.ceil((query.data?.count??0)/size))}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" title="Página anterior" disabled={page===0||query.isFetching} onClick={()=>setPage(page-1)}><ChevronLeft/></Button><Button variant="outline" size="icon" aria-label="Próxima página" title="Próxima página" disabled={(page+1)*size>=(query.data?.count??0)||query.isFetching} onClick={()=>setPage(page+1)}><ChevronRight/></Button></div></div></>}
 </section>;
}
export function UsuariosTab({userId}: {userId:string}){
 const qc=useQueryClient();const [draft,setDraft]=useState<Record<string,string>>({});
 const query=useQuery({queryKey:['sindico','usuarios'],queryFn:async()=>{const {data,error}=await supabase.from('perfis').select('*').order('email');if(error)throw error;return data;}});
 const save=useMutation({mutationFn:async({id,papel}: {id:string;papel:Tables<'perfis'>['papel']})=>{
 if(!podeAlterarPapel(id===userId,papel))throw new Error('Você não pode remover seu próprio papel de síndico.');
 const {error}=await supabase.from('perfis').update({papel}).eq('user_id',id).select('user_id').single();if(error)throw error;
 },onSuccess:()=>{toast.success('Papel atualizado.');qc.invalidateQueries({queryKey:['sindico','usuarios']});qc.invalidateQueries({queryKey:['perfil']});},onError:e=>toast.error(e instanceof Error?e.message:erroDados(e))});
 return <section className="space-y-5">{query.isLoading?<Loading/>:query.isError?<ErrorNotice text="Não foi possível carregar os usuários."/>:<GridTable headers={['E-mail','Papel','']}>{query.data?.map(u=>{const own=u.user_id===userId;const value=draft[u.user_id]??u.papel??'nenhum';return <tr key={u.user_id}><td className={`${cell} break-all`}>{u.email??'Sem e-mail'}{own&&<span className="ml-2 text-xs text-muted-foreground">(você)</span>}</td><td className={`${cell} min-w-48`}>{own?<span>Síndico</span>:<Choice label={`Papel de ${u.email??'usuário'}`} value={value} onChange={v=>setDraft({...draft,[u.user_id]:v})} items={[{value:'nenhum',label:'Sem papel'},{value:'PORTEIRO',label:'Porteiro'},{value:'SINDICO',label:'Síndico'}]}/>}</td><td className={cell}>{!own&&<Button variant="outline" size="icon" title="Salvar papel" aria-label={`Salvar papel de ${u.email??'usuário'}`} disabled={save.isPending||value===(u.papel??'nenhum')} onClick={()=>save.mutate({id:u.user_id,papel:value==='SINDICO'?'SINDICO':value==='PORTEIRO'?'PORTEIRO':null})}><Save/></Button>}</td></tr>;})}</GridTable>}</section>;
}
