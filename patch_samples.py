import json
import glob

template = {
    "username": "demo_user",
    "timeallotted": 3600,
    "allsectionaltimetaken": {},
    "coursename": "rbiassistantp",
    "qsections": {"qa": 35, "el": 30, "lr": 35},
    "userid": 9999999,
    "testids": [],
    "timings": {
        "qa": ["Numerical Ability", 35, 1200, "20 Minutes"],
        "el": ["English Language", 30, 1200, "20 Minutes"],
        "lr": ["Reasoning Ability", 35, 1200, "20 Minutes"]
    },
    "results": []
}

for filename in glob.glob('sample_inject_*.json'):
    with open(filename, 'r') as f:
        data = json.load(f)
    
    if "results" not in data:
        # Wrap it!
        new_data = template.copy()
        new_data["results"] = [data]
        new_data["testids"] = [data.get("testid", 999)]
        with open(filename, 'w') as f:
            json.dump(new_data, f, indent=2)
        print(f"Patched {filename}")

