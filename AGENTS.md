<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store administration lives under the managed authenticated route; each administration server function independently validates roles before private reads or mutations.
- Ordinary store administration uses the authenticated RLS client; privileged staff management loads the admin client only after validating the Super Admin role.
- Product administration edits the existing sourced catalogue instead of allowing arbitrary new products, preserving catalogue provenance.
