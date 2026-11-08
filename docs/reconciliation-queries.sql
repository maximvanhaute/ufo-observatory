-- Reconciliation with the app, 8 November 2026.
-- Run against the same snapshot as Final File Swear on god for now!.json.
-- Date_Fixed is MDY. Style 110 makes that explicit after slash normalization:
-- https://learn.microsoft.com/en-us/sql/t-sql/functions/cast-and-convert-transact-sql
-- These queries have been reproduced against the exported files; we have not
-- executed them against the live Lakehouse in this update.

-- 1. Hourly chart. A flagged calendar year does not invalidate TimeOnly.
SELECT DATEPART(hour, TRY_CAST(TimeOnly AS TIME)) AS Hour_of_Day,
       COUNT(ID) AS Observation_Count
FROM ufo_sighting
WHERE TRY_CAST(TimeOnly AS TIME) IS NOT NULL
GROUP BY DATEPART(hour, TRY_CAST(TimeOnly AS TIME))
ORDER BY Hour_of_Day;

-- 2. All-years comparison. Equal weight per active matched year, not per
-- resident-year. Years without reports do not enter this arithmetic mean.
-- DC's abbreviation is blank in the supplied population file. The app repairs
-- it from the exact full name; this CTE applies the same normalization.
WITH Parsed_Sightings AS (
    SELECT UPPER(State) AS State_Abbreviation,
           YEAR(TRY_CONVERT(DATE, REPLACE(Date_Fixed, '/', '-'), 110)) AS Sighting_Year,
           ID
    FROM ufo_sighting
), Yearly_Sightings AS (
    SELECT State_Abbreviation, Sighting_Year, COUNT(ID) AS Total_Sightings
    FROM Parsed_Sightings
    WHERE Sighting_Year IS NOT NULL
    GROUP BY State_Abbreviation, Sighting_Year
), Population_Normalized AS (
    SELECT COALESCE(NULLIF(UPPER(state_abbr), ''),
                    CASE WHEN state = 'District of Columbia' THEN 'DC' END) AS State_Abbreviation,
           state AS State_Name, year AS Population_Year, population
    FROM state_pop
), Yearly_Per_Capita AS (
    SELECT y.State_Abbreviation, p.State_Name, y.Sighting_Year, y.Total_Sightings, p.population,
           CAST(y.Total_Sightings AS FLOAT) / p.population * 100000 AS Yearly_Rate_Per_100k
    FROM Yearly_Sightings y
    INNER JOIN Population_Normalized p
      ON y.State_Abbreviation = p.State_Abbreviation AND y.Sighting_Year = p.Population_Year
    WHERE p.population > 0
)
SELECT State_Abbreviation, State_Name,
       ROUND(AVG(Yearly_Rate_Per_100k), 2) AS Average_Annual_Sightings_Per_100k,
       COUNT(Sighting_Year) AS Active_Years_Count,
       SUM(Total_Sightings) AS Reports_Compared,
       AVG(CAST(Total_Sightings AS FLOAT)) AS Average_Reports_Per_Active_Year,
       AVG(CAST(population AS FLOAT)) AS Average_Population_Active_Years
FROM Yearly_Per_Capita
GROUP BY State_Abbreviation, State_Name
ORDER BY Average_Annual_Sightings_Per_100k DESC;
