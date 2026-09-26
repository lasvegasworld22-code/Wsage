import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorText } from '../lib/api';
import { Action } from './Primitives';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from './ui/alert-dialog';

export const DeleteAgent = ({ agent, refresh, navigate }) => {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    try {
      await api.delete('/agents/' + agent.id);
      setOpen(false);
      await refresh();
      navigate('/create');
      toast.success('Agent deleted. Your work archive is preserved.');
    } catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  }
  return <div className="delete-agent-section">
    <button className="text-link delete-agent-link" data-testid="profile-delete-agent" disabled={agent.status==='WORKING'} onClick={()=>setOpen(true)}><Trash2 size={14}/>Delete agent</button>
    {agent.status==='WORKING'&&<small data-testid="delete-agent-working-note">Available after the current mission finishes.</small>}
    <AlertDialog open={open} onOpenChange={value=>!busy&&setOpen(value)}>
      <AlertDialogContent className="agent-delete-dialog" data-testid="delete-agent-dialog">
        <AlertDialogTitle data-testid="delete-agent-title">Delete {agent.name}?</AlertDialogTitle>
        <AlertDialogDescription data-testid="delete-agent-description">This removes your agent from the plaza and frees your wallet to create a replacement. Reports remain in your private Work Feed. The old identity and treasury are archived, not transferred. This cannot be undone.</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="delete-agent-cancel" disabled={busy}>Keep agent</AlertDialogCancel>
          <Action data-testid="delete-agent-confirm" busy={busy} onClick={remove}><Trash2 size={14}/>Delete agent</Action>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
};