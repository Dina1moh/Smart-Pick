"""CrewAI agent: Customer Sentiment Analyst.

The quality-score math is deterministic and runs inside the injected tool, so the
agent stays fast and reproducible. The agent simply triggers the scoring tool for
the products discovered by the search agent.
"""

from crewai import Agent, LLM


REVIEW_AGENT_BACKSTORY = (
    "You are SmartPick's Customer Sentiment Analyst. You translate raw ratings and "
    "review volume into a single trustworthy quality score for every product, "
    "treating all retailers equally. You rely on the scoring tool rather than "
    "guessing."
)


def build_review_agent(llm: LLM, tools: list) -> Agent:
    return Agent(
        role="Customer Sentiment Analyst",
        goal="Compute a quality score for every discovered product from its ratings and reviews.",
        backstory=REVIEW_AGENT_BACKSTORY,
        tools=tools,
        llm=llm,
        allow_delegation=False,
        max_iter=3,
        verbose=False,
    )
