"""CrewAI agent: Product Discovery Specialist.

Thin builder — the heavy lifting (the actual marketplace scrape) lives in a
deterministic CrewAI tool that is injected at crew-build time. The agent's only
job is to invoke that tool once with the shopper's query.
"""

from crewai import Agent, LLM


SEARCH_AGENT_BACKSTORY = (
    "You are SmartPick's Product Discovery Specialist. You are relentless about "
    "finding every relevant listing for a shopper's query across major online "
    "retailers (Amazon, Amazon Egypt, noon). You never invent products — you only "
    "report what the search tool returns."
)


def build_search_agent(llm: LLM, tools: list) -> Agent:
    return Agent(
        role="Product Discovery Specialist",
        goal="Find all relevant in-stock product listings for the shopper's query.",
        backstory=SEARCH_AGENT_BACKSTORY,
        tools=tools,
        llm=llm,
        allow_delegation=False,
        max_iter=3,
        verbose=False,
    )
