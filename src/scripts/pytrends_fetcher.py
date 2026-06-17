"""
TubeForge — Google Trends Fetcher (pytrends sidecar)

Reads JSON from stdin: {"keyword": "...", "timeframe": "today 3-m"}
Outputs JSON to stdout matching GoogleTrendsResult schema.
"""
import sys
import json
import traceback


def fetch_trends(keyword: str, timeframe: str = "today 3-m") -> dict:
    try:
        from pytrends.request import TrendReq
    except ImportError:
        return {"error": "pytrends_not_installed"}

    try:
        pytrends = TrendReq(hl="en-US", tz=360)
        pytrends.build_payload([keyword], timeframe=timeframe)

        interest_over_time = pytrends.interest_over_time()
        related_queries = pytrends.related_queries()
        interest_by_region = pytrends.interest_by_region(
            resolution="COUNTRY", inc_low_vol=True, inc_geo_code=False
        )

        # Compute search score: average interest over the timeframe (0-100)
        if interest_over_time is not None and not interest_over_time.empty:
            avg_interest = float(interest_over_time[keyword].mean())
            search_score = round(min(avg_interest, 100))
        else:
            avg_interest = 0
            search_score = 0

        # Determine trend direction
        if interest_over_time is not None and len(interest_over_time) >= 2:
            first_half = interest_over_time[keyword].iloc[: len(interest_over_time) // 2].mean()
            second_half = interest_over_time[keyword].iloc[len(interest_over_time) // 2 :].mean()
            if second_half > first_half * 1.1:
                trend_direction = "rising"
            elif second_half < first_half * 0.9:
                trend_direction = "falling"
            else:
                trend_direction = "stable"
        else:
            trend_direction = "stable"

        # Extract related queries
        related_rising = []
        related_top = []
        if related_queries and keyword in related_queries:
            rising_df = related_queries[keyword].get("rising")
            top_df = related_queries[keyword].get("top")
            if rising_df is not None:
                related_rising = rising_df["query"].head(10).tolist()
            if top_df is not None:
                related_top = top_df["query"].head(10).tolist()

        # Determine seasonality: check if interest varies > 50% across months
        seasonal = False
        if interest_over_time is not None and len(interest_over_time) >= 3:
            values = interest_over_time[keyword].values
            if values.max() > 0:
                seasonal = (values.max() - values.min()) / values.max() > 0.5

        # Recommended tags: combine rising + top, deduplicate, take top 5
        recommended_tags = list(dict.fromkeys(related_rising + related_top))[:5]

        return {
            "primaryKeyword": keyword,
            "searchScore": search_score,
            "trendDirection": trend_direction,
            "relatedRising": related_rising,
            "relatedTop": related_top,
            "seasonal": seasonal,
            "recommendedTags": recommended_tags,
            "fetchedAt": "",
        }

    except Exception as e:
        error_msg = str(e).lower()
        if "429" in error_msg or "rate" in error_msg or "too many" in error_msg:
            return {"error": "rate_limited"}
        return {"error": f"pytrends_error: {str(e)}"}


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(json.dumps({"error": "no_input"}))
            return

        input_data = json.loads(raw)
        keyword = input_data.get("keyword", "")
        timeframe = input_data.get("timeframe", "today 3-m")

        if not keyword:
            print(json.dumps({"error": "missing_keyword"}))
            return

        result = fetch_trends(keyword, timeframe)
        print(json.dumps(result))

    except json.JSONDecodeError:
        print(json.dumps({"error": "invalid_json_input"}))
    except Exception:
        print(json.dumps({"error": "unexpected_error"}))


if __name__ == "__main__":
    main()
