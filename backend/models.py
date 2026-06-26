from pydantic import BaseModel
from enum import Enum


class Priority(str, Enum):
    LOWEST_PRICE = "lowest_price"
    BEST_RATING = "best_rating"
    BEST_WARRANTY = "best_warranty"
    FASTEST_DELIVERY = "fastest_delivery"


class CompareRequest(BaseModel):
    product: str
    priority: Priority
    category: str | None = None


class ProductResult(BaseModel):
    title: str
    url: str
    price: float | None = None
    currency: str = "$"
    stars: float | None = None
    reviews_count: int | None = 0
    quality_score: float = 0.0
    delivery: str | None = None
    warranty: str | None = None
    image: str | None = None
    in_stock: bool = True
    rank: int = 0
    source: str = ""


class CompareResponse(BaseModel):
    product_query: str
    priority: Priority
    category: str | None = None
    top_pick: ProductResult | None = None
    results: list[ProductResult] = []
    justification: str = ""
    total_found: int = 0
