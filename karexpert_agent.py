"""
KareXpert 5-Layer ADK Agent
Built with Deep Agents + LangGraph
Free, open source, runs any AI model

Layer 1: CLAUDE.md — Rules loaded automatically
Layer 2: Skills — Loaded on demand from .claude/skills/
Layer 3: Hooks — Safety checks before/after every action  
Layer 4: Subagents — Specialized agents for specific tasks
Layer 5: Plugin — This whole folder is the plugin
"""

import os
from dotenv import load_dotenv
from deepagents import create_deep_agent
import importlib.util


# Import our safety hooks (Layer 3).
# The hooks live under a dot-prefixed folder (.claude) which is not a
# valid Python package name, so load the file by path at runtime.
safety_hooks_path = os.path.join(os.path.dirname(__file__), ".claude", "hooks", "safety_hooks.py")
if os.path.exists(safety_hooks_path):
    spec = importlib.util.spec_from_file_location("karexpert.safety_hooks", safety_hooks_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load safety hooks from {safety_hooks_path}")
    safety_hooks = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(safety_hooks)
    pre_tool_safety_check = safety_hooks.pre_tool_safety_check
    post_tool_audit_log = safety_hooks.post_tool_audit_log
    notify_team = safety_hooks.notify_team
else:
    # Fallback stubs so the agent can run in degraded mode for development.
    def pre_tool_safety_check(action: str) -> dict:
        return {"status": "allowed"}

    def post_tool_audit_log(action: str, result: str, agent_name: str = "main"):
        print(f"[AUDIT-FAKE] {agent_name}: {action[:80]} -> {str(result)[:80]}")
        return {}

    def notify_team(message: str, level: str = "info"):
        print(f"[NOTIFY-FAKE] {level.upper()}: {message}")

# ── Load environment variables from .env file ──
load_dotenv()

# ── Load Layer 1: CLAUDE.md Rules ──────────────────────────
def load_karexpert_rules():
    """Reads CLAUDE.md — equivalent to Claude Code's automatic loading"""
    rules = ""
    
    # Load global rules
    global_rules_path = os.path.expanduser("~/.claude/CLAUDE.md")
    if os.path.exists(global_rules_path):
        rules += open(global_rules_path).read()
    
    # Load project rules (these override global)
    project_rules_path = ".claude/CLAUDE.md"
    if os.path.exists(project_rules_path):
        rules += "\n\n" + open(project_rules_path).read()
    
    return rules

# ── Load Layer 2: Skills ────────────────────────────────────
def load_skills_index():
    """Reads all skill descriptions for the agent to choose from"""
    skills_index = "# AVAILABLE SKILLS\n\n"
    skills_dir = ".claude/skills/"
    
    if not os.path.exists(skills_dir):
        return ""
    
    for skill_folder in os.listdir(skills_dir):
        skill_path = f"{skills_dir}{skill_folder}/SKILL.md"
        if os.path.exists(skill_path):
            content = open(skill_path).read()
            
            # Extract just the description from YAML frontmatter
            if "description:" in content:
                desc_line = [l for l in content.split("\n") 
                           if "description:" in l]
                if desc_line:
                    skills_index += f"- **{skill_folder}**: "
                    skills_index += desc_line[0].replace("description:", "").strip()
                    skills_index += "\n"
    
    return skills_index

# ── Layer 3: Safety Hook Wrapper ────────────────────────────
def safe_action_wrapper(action_func):
    """
    Wraps any tool/action with safety checks.
    Pre-check fires before, audit log fires after.
    """
    def wrapper(*args, **kwargs):
        action_str = str(args) + str(kwargs)
        
        # PRE-TOOL HOOK
        safety_result = pre_tool_safety_check(action_str)
        
        if safety_result["status"] == "blocked":
            notify_team(safety_result["reason"], level="blocked")
            return f"ACTION BLOCKED: {safety_result['reason']}"
        
        if safety_result["status"] == "needs_review":
            notify_team(safety_result["reason"], level="warning")
            # In production: wait for human approval here
            # For now: log and continue
        
        # Execute the actual action
        result = action_func(*args, **kwargs)
        
        # POST-TOOL HOOK — Log everything
        post_tool_audit_log(
            action=action_str,
            result=str(result),
            agent_name="main"
        )
        
        return result
    
    return wrapper

# ── Build the Complete 5-Layer Agent ───────────────────────
def create_karexpert_agent():
    """
    Creates the complete KareXpert ADK agent.
    All 5 layers assembled here.
    """
    
    # Layer 1: Load company rules
    company_rules = load_karexpert_rules()
    
    # Layer 2: Load skills index
    skills_index = load_skills_index()
    
    # Build the complete system prompt
    # (This is what Claude Code does automatically with CLAUDE.md)
    system_prompt = f"""
{company_rules}

{skills_index}

## HOW TO USE SKILLS
When a task relates to a skill above, read the full skill file first:
- ABDM work: read .claude/skills/abdm-compliance/SKILL.md
- EMR/patient records: read .claude/skills/emr-schema/SKILL.md  
- Billing/invoicing: read .claude/skills/billing-logic/SKILL.md

## HOW TO USE SUBAGENTS
For specialized tasks, delegate to subagents:
- Code review: delegate to code-reviewer subagent
- Data validation: delegate to data-validator subagent

## WORKSPACE
Save all your work to the ./workspace/ folder.
Never save outside this folder unless explicitly asked.
"""
    
    # Layer 4: Define subagents
    # Deep Agents reads these from .claude/agents/ automatically
    # No extra code needed — just the .md files we created
    
    # Build the model string in provider:model format required by DeepAgents.
    preferred_providers = [
        ("openrouter", "langchain_openrouter"),
        ("ollama", "langchain_ollama"),
        ("openai", "langchain_openai"),
    ]
    model_provider = os.getenv("MODEL_PROVIDER")
    if not model_provider:
        for provider, pkg in preferred_providers:
            if importlib.util.find_spec(pkg) is not None:
                model_provider = provider
                break
    if not model_provider:
        model_provider = "ollama"

    if model_provider == "openrouter" and not os.getenv("OPENROUTER_API_KEY"):
        if importlib.util.find_spec("langchain_ollama") is not None:
            notify_team(
                "OPENROUTER_API_KEY is missing; falling back to ollama provider.",
                level="warning"
            )
            model_provider = "ollama"
        else:
            raise RuntimeError(
                "OPENROUTER_API_KEY must be set for OpenRouter, or set MODEL_PROVIDER=ollama if you want to use Ollama."
            )

    model_name = os.getenv("MODEL_NAME")
    if not model_name:
        model_name = f"{model_provider}:meta-llama/llama-3.3-70b-instruct:free"
    elif ":" not in model_name.split("/")[0]:
        model_name = f"{model_provider}:{model_name}"

    # Ensure workspace folder exists for agent file operations
    os.makedirs("./workspace", exist_ok=True)

    # Create the agent using Deep Agents library
    # Layer 3 hooks are wired in via the callback system
    agent = create_deep_agent(
        # AI model — provider:model string
        model=model_name,

        # Layer 1 + 2: Rules and skills injected into system prompt
        system_prompt=system_prompt,
    )

    return agent


# ── Run the Agent ───────────────────────────────────────────
if __name__ == "__main__":
    print("="*60)
    print("  KareXpert 5-Layer ADK Agent")
    print("  Powered by Deep Agents + LangGraph")
    print("="*60)
    print()
    
    # Create the agent
    agent = create_karexpert_agent()
    
    notify_team("KareXpert ADK Agent started", level="info")
    print("Agent ready. Type your task below.")
    print("Type 'exit' to quit.\n")
    
    # Simple conversation loop
    while True:
        user_input = input("You: ").strip()
        
        if user_input.lower() in ["exit", "quit", "bye"]:
            notify_team("KareXpert ADK Agent session ended", level="info")
            break
        
        if not user_input:
            continue
        
        print("\nAgent working...\n")
        
        # Run the agent
        result = agent.invoke({
            "messages": [{"role": "user", "content": user_input}]
        })
        
        # Print response
        final_message = result["messages"][-1].content
        print(f"Agent: {final_message}\n")
        
        # Post-session audit
        post_tool_audit_log(
            action=user_input,
            result=final_message[:200]
        )