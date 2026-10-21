begin;

-- Committee transparency applies as soon as a ballot is submitted.
-- Drafts stay visible only to their owner and administrators.
drop policy if exists committee_vote_read on public.votes;
create policy committee_vote_read on public.votes for select to authenticated using (
    public.current_app_role() = 'admin' or (public.is_active_poll_member() and
        (voter_id = auth.uid() or status = 'submitted'))
);

notify pgrst, 'reload schema';
commit;
