"""CrewAI agent: Decision Optimization Expert.

Ranking is deterministic (handled by the injected tool) so the ordering is always
reproducible for a given priority. The LLM's value-add here is the final
human-readable justification of the top pick.
"""

from crewai import Agent, LLM


RANKING_AGENT_BACKSTORY = (
    "You are SmartPick's Decision Optimization Expert. You rank products purely on "
    "merit for the shopper's chosen priority — the best pick can come from any "
    "store — and then explain, in plain language, exactly why the winner beats the "
    "alternatives, citing concrete numbers."
)


def build_ranking_agent(llm: LLM, tools: list) -> Agent:
    return Agent(
        role="Decision Optimization Expert",
        goal=(
            "Rank the scored products by the shopper's priority and justify the #1 "
            "pick with specific numbers."
        ),
        backstory=RANKING_AGENT_BACKSTORY,
        tools=tools,
        llm=llm,
        allow_delegation=False,
        max_iter=3,
        verbose=False,
    )
