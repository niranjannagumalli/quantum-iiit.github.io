# System Requirements Document (SRD)
## Quantum Meets Automated Seminar Pipeline

**Document Status:** Approved & Updated (v1.5)  
**Target Repository:** `quantum-iiit.github.io`  

---

## 1. Executive Summary & Objective

The **Quantum Meets Automated Seminar Pipeline** is an end-to-end automation and orchestration system designed to streamline the complete lifecycle of scientific talks for the Quantum Meets seminar series.

The expanded lifecycle covers three major phases:
1. **Intake, Image & Scheduling:** Ingesting speaker submissions from Google Forms, scraping and face-cropping portrait images from the speaker's website, formatting for GitHub CDN hosting via the `gh image` CLI extension, formatting plain-text abstracts to Markdown, validating through human checkpoints, creating Google Calendar events, publishing to either `Upcoming` or `Pipeline` sections on `content.md`, and **immediately syndicating via RSS (`feed.xml`)**.
2. **Post-Event Archival & Lifecycle:** Promoting talks from `Pipeline` to `Upcoming` by Sunday noon IST (with RSS update), moving finished talks from `Upcoming` to `past.md`, and managing reschedules or cancellations.
3. **Video Processing & YouTube Publishing:** Editing Microsoft Teams recordings (dynamic slide crop, speaker top-right anchoring, participant blurring, speech-based intro/outro cutoff), local review gating, unlisted YouTube upload, strict metadata formatting, playlist categorization, public release sign-off, **RSS update with YouTube recording**, and dual-credit logging in `contribute.md`.

---

## 2. Process Flow & Human-in-the-Loop Architecture

[![Process Flow Diagram](https://mermaid.ink/img/pako:eJyVWAtv2zgS_isDF40dQE5tx3msb68Lx05aX53UjZ203cthQUsjmbAkCiSVxJf6v--QlF9Z-bYXIIgicr6Z-eZF8aXiiwArHai8ffvCU6478PKQAlT1DBOsdqA6ZQqr3ubdPZOcTWNU1WIrLQRMzq8Jh16FLFboFe-nzJ9HUuRpYJDehPanulpNGE8v5lHZUkpgF0IGKO1qE1u_HE_Xq5nkCZOLnoiFLJMu1if4rDd7GmHzrMVe73FKNrteaYp5insXFfoiDXYNwfDYP1vv0Cg1391wHrLQX28IRaqvWMLjhVlVC6UxqefcgzrLshjr7o0HiqWqrlDycEd0zP9rY9Q8yZ6r5v3yIV0u3759SMNYPPkzJjVM-k7Aj5lSfQwhwJDlsYaQx3GnoM5TWoo5dgoXi3_rTzzQs04re_Z840GnINEzuutPyKOZ7pw2Gv94pSFiGlfwlpA1_LR9ctz4ZS_82fnxSSPcgZ-KOHiNz3zNRVpowDA83XYgaGNwvldDE4_Z-d86QHFLeMrilQo_DMKTtYpG--z85Gw_R6dtJAr_RoXKp9GKI5sTa_jT9ln7_P8KQcGR02CAJctmMJpR5Tb__VCxD9DswDhDNkcJg1TTXw8GCYsQDmDszzDIKdejh8p_HIr56ZLsSqTr-5hpRaKPXCNt63Q6RRjq9fdwsbX1ipxS8EGIKEa4EjL5dSrfva9NuI5JJ5Pf-KMH3Sn5RwDmSeQaRmSJB6aHHDrwIks31lxYRT1S1M21SCjFgsIRuEwjqtNtozZim6eeBegTwFecks9EEll7-WztUESX0MKaGkqRbJm1x56-hbt8MfySJHlKbQ6ID0JXxNFvD5UlyZla2AhdkhA8VL6jeqhY-SvjzwDewecM0949XDEfoSdF5kgbKBHbYqLXHjTbjewZNJMR6n00FRpuRKHgg0kAiixcU7fV9Es-k7XjfJpw7Zx2SLZorUll5F3ZpY9_8CQiwLssFiyAR84gmgG3adQbDjrW6PWbF0pvXJKgxEzAi3gi3e_M89LuWzOfU2OrM62ZP0swpRe9_g3c3Q5_LqC9UZNi0JuhP88EuQhNqPVYjKYzwwdy6tCZ1RNpyGUC41hoyvl7THMsCxHhOQq7WSbFIwYFkQPyuyfRsHT5SGYCT1dJvlLnYlb9krNU5wlcI5IzP2AwGEyqhz_nzb_-0M_a5ERRH5SBkughg00lEUkonTujmGIJZsSBiTLXH_MpxVjOA-IZatdMzzzocc2MPrUvWzZPNrSkZkC_1oiC3NYuuS2oFfm9ze0tPnJ8Wqv3HLuEZCJpu0wZ09uct0o5_0TKB6rgu2-of-J6xlMXUOQxiBBuDAdfEee_Of5__ad7NaZ6ZIvDMs2fXpfh0FAeBKYy3ryBu8wXiakZYphGvCbtR0lQHsBPr-rtegdpxDM0Z4ifQdo8DYm5a4t2Ox6bDn6LEVLx2E6AGBw9JzHUbohxy8yh9fvAJAGMcjVz8KsZtoElyKP6-x-OF7gR1KtG1OqE7eITpuY_YOh2UzaXj5PWepy0OjASStddbCaSDijcAjk7xovU3xkmQ-vPDclPWDwHqkY_zgNUFCYaLUqFeRwv9mTpjZX9TLLXlBxgAS5i4c_BtGrr_YZcw3zG1H6eP1u0EaEZQ3siMY3wwDK36t1b_pSRuZee4zU9xx245wEKGlERqoIYGlcYxzwyjF0GBP9q4H4xoWZPVNUsUXBLx0sZmDSsHSVZ20W5NhQ-nUtoXqTYl5zYWCvYrXGXPm4soz-DLlm_UFxR_c64MpOvO74tyvcjBdKmQkZ82LqtTmYsncN3kVfpjS4n8ovVMTZ9kURz4oh8VsbVIVuY6dlHjVbGqekvUjrq-tSBiRnlrY8jB6bJae7zjPqmKtd1a3VN7PQPuHjnyJ3QId4Wau3qKskw2tNkx1b4joRXJpgJm5GgRywrItRgHFBO5VK6oJSgTGjHnUW6JyQTPzqBODtG0jbAkvTdmyrtdaq0OzB5EvWxNjOTGJ_kUySzYjSLB3-tpPuiMx_vduZjKHKjaMZb7bnoqiaSihBddIpu-TkzXpKY5gnlEUsyoK1EA4WotHeS4tJe_XVzLqAKXPnBFNzdDAfjyWW_nNWvVvgbCbsBB2MtuW9yR_mSW-NWbb3ZaID5piFT6ShJj-S7Bxm1WFCYMWqPQnp28wUdiN2u7ZPm-uhJ3ntgkt6jLkjnqWjvfPxmrftu0k4pHqXGNZq8i5hTxdTwKDqCVqN1uifvvheRau9Gqg21FT0m6Cb3toJ1b77yFnCXGh2UYfYgVBaGtgvDmMyqizAswvC7KXmaklTyKyUuR43ldxfDQa_c1t-tdLdroxiYSVM0UTty11h7j2XdrgMwXwJDERl1pidLPqXGQDDOuReXnCiXlIerc9KF2NNguu7M3-39rxFovfuZEbhViiOL--UhrXhQSWgX40GlAy8Ve8NhbkPMrYdZ3L3ysHtWlx2V1WWH2b265zCyxTe1xXZXHK_ebt9flC-try7ssvvk21reurWwG9xXu9mwvrB49X5z0WAWfuaiobJcLv8E-NumUQ==?bgColor=white)](https://mermaid.live/edit#pako:eJyVWAtv2zgS_isDF40dQE5tx3msb68Lx05aX53UjZ203cthQUsjmbAkCiSVxJf6v--QlF9Z-bYXIIgicr6Z-eZF8aXiiwArHai8ffvCU6478PKQAlT1DBOsdqA6ZQqr3ubdPZOcTWNU1WIrLQRMzq8Jh16FLFboFe-nzJ9HUuRpYJDehPanulpNGE8v5lHZUkpgF0IGKO1qE1u_HE_Xq5nkCZOLnoiFLJMu1if4rDd7GmHzrMVe73FKNrteaYp5insXFfoiDXYNwfDYP1vv0Cg1391wHrLQX28IRaqvWMLjhVlVC6UxqefcgzrLshjr7o0HiqWqrlDycEd0zP9rY9Q8yZ6r5v3yIV0u3759SMNYPPkzJjVM-k7Aj5lSfQwhwJDlsYaQx3GnoM5TWoo5dgoXi3_rTzzQs04re_Z840GnINEzuutPyKOZ7pw2Gv94pSFiGlfwlpA1_LR9ctz4ZS_82fnxSSPcgZ-KOHiNz3zNRVpowDA83XYgaGNwvldDE4_Z-d86QHFLeMrilQo_DMKTtYpG--z85Gw_R6dtJAr_RoXKp9GKI5sTa_jT9ln7_P8KQcGR02CAJctmMJpR5Tb__VCxD9DswDhDNkcJg1TTXw8GCYsQDmDszzDIKdejh8p_HIr56ZLsSqTr-5hpRaKPXCNt63Q6RRjq9fdwsbX1ipxS8EGIKEa4EjL5dSrfva9NuI5JJ5Pf-KMH3Sn5RwDmSeQaRmSJB6aHHDrwIks31lxYRT1S1M21SCjFgsIRuEwjqtNtozZim6eeBegTwFecks9EEll7-WztUESX0MKaGkqRbJm1x56-hbt8MfySJHlKbQ6ID0JXxNFvD5UlyZla2AhdkhA8VL6jeqhY-SvjzwDewecM0949XDEfoSdF5kgbKBHbYqLXHjTbjewZNJMR6n00FRpuRKHgg0kAiixcU7fV9Es-k7XjfJpw7Zx2SLZorUll5F3ZpY9_8CQiwLssFiyAR84gmgG3adQbDjrW6PWbF0pvXJKgxEzAi3gi3e_M89LuWzOfU2OrM62ZP0swpRe9_g3c3Q5_LqC9UZNi0JuhP88EuQhNqPVYjKYzwwdy6tCZ1RNpyGUC41hoyvl7THMsCxHhOQq7WSbFIwYFkQPyuyfRsHT5SGYCT1dJvlLnYlb9krNU5wlcI5IzP2AwGEyqhz_nzb_-0M_a5ERRH5SBkughg00lEUkonTujmGIJZsSBiTLXH_MpxVjOA-IZatdMzzzocc2MPrUvWzZPNrSkZkC_1oiC3NYuuS2oFfm9ze0tPnJ8Wqv3HLuEZCJpu0wZ09uct0o5_0TKB6rgu2-of-J6xlMXUOQxiBBuDAdfEee_Of5__ad7NaZ6ZIvDMs2fXpfh0FAeBKYy3ryBu8wXiakZYphGvCbtR0lQHsBPr-rtegdpxDM0Z4ifQdo8DYm5a4t2Ox6bDn6LEVLx2E6AGBw9JzHUbohxy8yh9fvAJAGMcjVz8KsZtoElyKP6-x-OF7gR1KtG1OqE7eITpuY_YOh2UzaXj5PWepy0OjASStddbCaSDijcAjk7xovU3xkmQ-vPDclPWDwHqkY_zgNUFCYaLUqFeRwv9mTpjZX9TLLXlBxgAS5i4c_BtGrr_YZcw3zG1H6eP1u0EaEZQ3siMY3wwDK36t1b_pSRuZee4zU9xx245wEKGlERqoIYGlcYxzwyjF0GBP9q4H4xoWZPVNUsUXBLx0sZmDSsHSVZ20W5NhQ-nUtoXqTYl5zYWCvYrXGXPm4soz-DLlm_UFxR_c64MpOvO74tyvcjBdKmQkZ82LqtTmYsncN3kVfpjS4n8ovVMTZ9kURz4oh8VsbVIVuY6dlHjVbGqekvUjrq-tSBiRnlrY8jB6bJae7zjPqmKtd1a3VN7PQPuHjnyJ3QId4Wau3qKskw2tNkx1b4joRXJpgJm5GgRywrItRgHFBO5VK6oJSgTGjHnUW6JyQTPzqBODtG0jbAkvTdmyrtdaq0OzB5EvWxNjOTGJ_kUySzYjSLB3-tpPuiMx_vduZjKHKjaMZb7bnoqiaSihBddIpu-TkzXpKY5gnlEUsyoK1EA4WotHeS4tJe_XVzLqAKXPnBFNzdDAfjyWW_nNWvVvgbCbsBB2MtuW9yR_mSW-NWbb3ZaID5piFT6ShJj-S7Bxm1WFCYMWqPQnp28wUdiN2u7ZPm-uhJ3ntgkt6jLkjnqWjvfPxmrftu0k4pHqXGNZq8i5hTxdTwKDqCVqN1uifvvheRau9Gqg21FT0m6Cb3toJ1b77yFnCXGh2UYfYgVBaGtgvDmMyqizAswvC7KXmaklTyKyUuR43ldxfDQa_c1t-tdLdroxiYSVM0UTty11h7j2XdrgMwXwJDERl1pidLPqXGQDDOuReXnCiXlIerc9KF2NNguu7M3-39rxFovfuZEbhViiOL--UhrXhQSWgX40GlAy8Ve8NhbkPMrYdZ3L3ysHtWlx2V1WWH2b265zCyxTe1xXZXHK_ebt9flC-try7ssvvk21reurWwG9xXu9mwvrB49X5z0WAWfuaiobJcLv8E-NumUQ==)  
*Tip: Click the image above to open the full-screen interactive diagram (zoom/pan), or view the [Vector SVG (High Contrast)](https://mermaid.ink/svg/pako:eJyVWAtv2zgS_isDF40dQE5tx3msb68Lx05aX53UjZ203cthQUsjmbAkCiSVxJf6v--QlF9Z-bYXIIgicr6Z-eZF8aXiiwArHai8ffvCU6478PKQAlT1DBOsdqA6ZQqr3ubdPZOcTWNU1WIrLQRMzq8Jh16FLFboFe-nzJ9HUuRpYJDehPanulpNGE8v5lHZUkpgF0IGKO1qE1u_HE_Xq5nkCZOLnoiFLJMu1if4rDd7GmHzrMVe73FKNrteaYp5insXFfoiDXYNwfDYP1vv0Cg1391wHrLQX28IRaqvWMLjhVlVC6UxqefcgzrLshjr7o0HiqWqrlDycEd0zP9rY9Q8yZ6r5v3yIV0u3759SMNYPPkzJjVM-k7Aj5lSfQwhwJDlsYaQx3GnoM5TWoo5dgoXi3_rTzzQs04re_Z840GnINEzuutPyKOZ7pw2Gv94pSFiGlfwlpA1_LR9ctz4ZS_82fnxSSPcgZ-KOHiNz3zNRVpowDA83XYgaGNwvldDE4_Z-d86QHFLeMrilQo_DMKTtYpG--z85Gw_R6dtJAr_RoXKp9GKI5sTa_jT9ln7_P8KQcGR02CAJctmMJpR5Tb__VCxD9DswDhDNkcJg1TTXw8GCYsQDmDszzDIKdejh8p_HIr56ZLsSqTr-5hpRaKPXCNt63Q6RRjq9fdwsbX1ipxS8EGIKEa4EjL5dSrfva9NuI5JJ5Pf-KMH3Sn5RwDmSeQaRmSJB6aHHDrwIks31lxYRT1S1M21SCjFgsIRuEwjqtNtozZim6eeBegTwFecks9EEll7-WztUESX0MKaGkqRbJm1x56-hbt8MfySJHlKbQ6ID0JXxNFvD5UlyZla2AhdkhA8VL6jeqhY-SvjzwDewecM0949XDEfoSdF5kgbKBHbYqLXHjTbjewZNJMR6n00FRpuRKHgg0kAiixcU7fV9Es-k7XjfJpw7Zx2SLZorUll5F3ZpY9_8CQiwLssFiyAR84gmgG3adQbDjrW6PWbF0pvXJKgxEzAi3gi3e_M89LuWzOfU2OrM62ZP0swpRe9_g3c3Q5_LqC9UZNi0JuhP88EuQhNqPVYjKYzwwdy6tCZ1RNpyGUC41hoyvl7THMsCxHhOQq7WSbFIwYFkQPyuyfRsHT5SGYCT1dJvlLnYlb9krNU5wlcI5IzP2AwGEyqhz_nzb_-0M_a5ERRH5SBkughg00lEUkonTujmGIJZsSBiTLXH_MpxVjOA-IZatdMzzzocc2MPrUvWzZPNrSkZkC_1oiC3NYuuS2oFfm9ze0tPnJ8Wqv3HLuEZCJpu0wZ09uct0o5_0TKB6rgu2-of-J6xlMXUOQxiBBuDAdfEee_Of5__ad7NaZ6ZIvDMs2fXpfh0FAeBKYy3ryBu8wXiakZYphGvCbtR0lQHsBPr-rtegdpxDM0Z4ifQdo8DYm5a4t2Ox6bDn6LEVLx2E6AGBw9JzHUbohxy8yh9fvAJAGMcjVz8KsZtoElyKP6-x-OF7gR1KtG1OqE7eITpuY_YOh2UzaXj5PWepy0OjASStddbCaSDijcAjk7xovU3xkmQ-vPDclPWDwHqkY_zgNUFCYaLUqFeRwv9mTpjZX9TLLXlBxgAS5i4c_BtGrr_YZcw3zG1H6eP1u0EaEZQ3siMY3wwDK36t1b_pSRuZee4zU9xx245wEKGlERqoIYGlcYxzwyjF0GBP9q4H4xoWZPVNUsUXBLx0sZmDSsHSVZ20W5NhQ-nUtoXqTYl5zYWCvYrXGXPm4soz-DLlm_UFxR_c64MpOvO74tyvcjBdKmQkZ82LqtTmYsncN3kVfpjS4n8ovVMTZ9kURz4oh8VsbVIVuY6dlHjVbGqekvUjrq-tSBiRnlrY8jB6bJae7zjPqmKtd1a3VN7PQPuHjnyJ3QId4Wau3qKskw2tNkx1b4joRXJpgJm5GgRywrItRgHFBO5VK6oJSgTGjHnUW6JyQTPzqBODtG0jbAkvTdmyrtdaq0OzB5EvWxNjOTGJ_kUySzYjSLB3-tpPuiMx_vduZjKHKjaMZb7bnoqiaSihBddIpu-TkzXpKY5gnlEUsyoK1EA4WotHeS4tJe_XVzLqAKXPnBFNzdDAfjyWW_nNWvVvgbCbsBB2MtuW9yR_mSW-NWbb3ZaID5piFT6ShJj-S7Bxm1WFCYMWqPQnp28wUdiN2u7ZPm-uhJ3ntgkt6jLkjnqWjvfPxmrftu0k4pHqXGNZq8i5hTxdTwKDqCVqN1uifvvheRau9Gqg21FT0m6Cb3toJ1b77yFnCXGh2UYfYgVBaGtgvDmMyqizAswvC7KXmaklTyKyUuR43ldxfDQa_c1t-tdLdroxiYSVM0UTty11h7j2XdrgMwXwJDERl1pidLPqXGQDDOuReXnCiXlIerc9KF2NNguu7M3-39rxFovfuZEbhViiOL--UhrXhQSWgX40GlAy8Ve8NhbkPMrYdZ3L3ysHtWlx2V1WWH2b265zCyxTe1xXZXHK_ebt9flC-try7ssvvk21reurWwG9xXu9mwvrB49X5z0WAWfuaiobJcLv8E-NumUQ==?bgColor=white).*

<details>
<summary><b>Click to view raw Mermaid code</b></summary>

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'darkMode': false,
    'background': '#ffffff',
    'mainBkg': '#ffffff',
    'nodeBorder': '#1e293b',
    'primaryColor': '#ffffff',
    'primaryTextColor': '#0f172a',
    'primaryBorderColor': '#1e293b',
    'lineColor': '#1e293b',
    'secondaryColor': '#fef3c7',
    'tertiaryColor': '#f8fafc',
    'fontFamily': 'system-ui, -apple-system, sans-serif',
    'fontSize': '15px'
  }
}}%%
flowchart TD
    classDef default fill:#ffffff,stroke:#1e293b,stroke-width:2px,color:#0f172a,font-weight:600;
    classDef gate fill:#fef3c7,stroke:#b45309,stroke-width:2px,color:#78350f,font-weight:bold;
    classDef action fill:#eff6ff,stroke:#1d4ed8,stroke-width:2px,color:#1e3a8a,font-weight:600;
    classDef terminal fill:#ecfdf5,stroke:#047857,stroke-width:2px,color:#064e3b,font-weight:600;

    subgraph Phase1["Phase 1: Speaker Intake, Image & Scheduling"]
        A["Speaker Accepts Invite"]:::action --> B["Speaker Fills Google Form<br/>(Title, arXiv, Abstract, About Page, Mode)"]:::default
        B --> C["Automated Intake Engine"]:::action
        
        C --> D["Web Scraper Extracts Photo<br/>from About Page"]:::default
        D --> E{"Photo Found on Website?"}:::gate
        E -- "Yes" --> F["AI / OpenCV Face Crop<br/>(Isolate face, 140px target)"]:::default
        E -- "No" --> G["Ping Maintainer to Submit Photo"]:::gate --> F
        
        F --> H_img["Upload via gh image CLI:<br/>gh image {file} --repo {owner/repo}<br/>Extracts user-attachments CDN URL"]:::action
        
        C --> CP1{"Checkpoint 1 (Calendar Gate):<br/>Confirm Slot & Venue"}:::gate
        CP1 -- "Approved" --> I["Create Event in Google Calendar<br/>('Quantum Meets | IIIT')"]:::action
        
        C --> J_txt["Abstract Parser & Formatter:<br/>Plain Text -> GitHub Markdown (Math, Citations)"]:::default
        
        H_img & I & J_txt --> CP2{"Checkpoint 2 (Website Gate):<br/>Review Markdown, Venue & CDN Image"}:::gate
        
        CP2 -- "Approved" --> K{"Is Event Date within<br/>Ceil of Next Week?<br/>(<= Next Sunday)"}:::gate
        K -- "Yes" --> L["Add to ## Upcoming in content.md"]:::action
        K -- "No" --> M["Add to ## Pipeline in content.md"]:::action
        
        L & M --> RSS1["Regenerate feed.xml (New Event)<br/>& Git Push"]:::terminal
        M -.->|Sunday Noon Promotion Task| L
    end

    subgraph Phase2["Phase 2: Post-Event Transition & Git Sync"]
        L --> N["Talk Concludes Successfully"]:::default
        N --> O["Move Talk Block from<br/>content.md to past.md"]:::action
        O --> P["Git Commit & Push Website Transition"]:::terminal
    end

    subgraph Phase3["Phase 3: Video Ingestion & Intelligent Editing"]
        Q["Raw Teams Recording (.mp4)<br/>(Local / OneDrive Ingestion)"]:::default --> R["Speech Analysis (Whisper ASR):<br/>Host Prompt Cue & 'Thank You' Cut"]:::action
        Q --> S["Computer Vision Layout Detection:<br/>Dynamic Slides, Speaker & Participants"]:::action
        R --> T["Audio/Video Trimming (FFmpeg)"]:::action
        S --> U["Dynamic Cropping, Rescaling & Blurring"]:::action
        T & U --> V["Edited Video Preview"]:::default
    end

    subgraph Phase4["Phase 4: Two-Stage YouTube Release & Sync"]
        V --> CP3{"Checkpoint 3 (Local Review Gate):<br/>Approve Cuts & Layout?<br/>(Optional timestamp overrides)"}:::gate
        CP3 -- "Approved" --> W["Upload to YouTube as UNLISTED"]:::action
        W --> X["Format Strict Description<br/>(<=100 char title check, pipe separator,<br/>Bold title, Abstract, arXiv, About, Host, No tags)"]:::default
        X --> Y["Assign to Playlist (e.g. 2026)"]:::action
        Y --> CP4{"Checkpoint 4 (YouTube Staging Gate):<br/>Verify Unlisted URL"}:::gate
        CP4 -- "Sign-off" --> Z["Switch YouTube Video to PUBLIC"]:::action
        Z --> AA["Update past.md with YouTube URL"]:::action
        AA --> AB["Log to contribute.md:<br/>{Reviewer} & Quantum Bot"]:::action
        AB --> AC["Regenerate feed.xml (New Video)<br/>& Git Push"]:::terminal
    end

    P --> Q
```

</details>

---

## 3. Detailed Functional Requirements

### FR-1: Speaker Intake & Google Form Ingestion
* **FR-1.1 (Google Form Intake):** Ingest responses from the Google Form:
  * Talk Title
  * arXiv / Paper URL
  * Abstract (raw text)
  * About Page (Speaker homepage, Google Scholar, or institution profile URL)
  * Scheduled Date & Time Slot
  * Mode: Online-only vs. Offline/Hybrid
* **FR-1.2 (Venue Resolution):**
  * If **Online-only**: Venue recorded as `Online-only` (or `presented online`); Teams meeting link attached.
  * If **Offline / Hybrid**: Prompt maintainer to confirm on-campus venue. Default fallback: `"Meeting Room, CQST, Vindhya (3rd level), IIIT Hyderabad"`.
* **FR-1.3 (Checkpoint 1 - Calendar Gate):**
  * Present formatted calendar event (Summary, Date/Time, Venue, Description with Teams link and abstract) to maintainer for verification.
  * Upon confirmation, create the entry on Google Calendar (*Quantum Meets | IIIT*).

### FR-2: Photo Scraping, Face Crop & Automated GitHub CDN Upload
* **FR-2.1 (Automated Photo Scraping):**
  * Crawl the speaker's "About" page to detect candidate portrait images (filtering by image dimensions, OpenGraph `og:image`, `img` tags matching profile/bio patterns).
* **FR-2.2 (Face Detection & Cropping):**
  * Detect the speaker's face using computer vision (OpenCV Haar Cascade / MediaPipe Face Detection).
  * Crop with proportional margin around the head and shoulders, producing a normalized portrait for the site (target display width: 140px).
* **FR-2.3 (Fallback Mechanism):**
  * If no photo is found or face detection confidence is low: ping the maintainer with a prompt to provide an image path/URL.
  * System applies the face cropping algorithm to the submitted image.
* **FR-2.4 (Automated GitHub CDN Hosting via `gh-image`):**
  * **Zero local attachments policy:** Images must **not** be stored in an `attachments/` folder in the repository to prevent git bloat.
  * System uploads the cropped face image using the GitHub CLI extension:
    ```bash
    gh image <path/to/cropped_face.png> --repo <owner/repo>
    ```
  * Extracts the generated markdown CDN link:
    `![image](https://github.com/user-attachments/assets/{uuid})`
  * Embeds the extracted URL into the site's standardized `<img>` tag:
    `<img align="left" width="140" alt="image" src="https://github.com/user-attachments/assets/{uuid}" />`
* **FR-2.5 (Abstract Markdown Formatter & Checkpoint 2 - Website Gate):**
  * Parse raw text abstract from the Google Form into GitHub-Flavored Markdown:
    * Standardize math notation (preserve KaTeX / LaTeX math `$..$` and `\(..\)`).
    * Format academic citations (e.g., `[LG17]`, `[HEC25]`).
    * Normalize paragraph breaks.
  * Present full markdown block (heading, image, abstract, metadata table) for maintainer sign-off before committing to `content.md`.

### FR-3: Section Routing (`Upcoming` vs. `Pipeline`) & Promotion
* **FR-3.1 (Section Routing Rule - Ceil of Next Week):**
  * Calculate the target event date relative to the current week:
    * **Within the Ceil of the Next Week:** If the event occurs between the current date and the end of the next calendar week (Sunday 23:59:59 IST), insert directly under `## Upcoming` in `content.md`.
    * **Beyond the Ceil of the Next Week:** If the event is scheduled beyond next week, insert under `## Pipeline` in `content.md`.
* **FR-3.2 (Sunday Noon Promotion Schedule):**
  * **Crucial Timing:** Pipeline-to-Upcoming promotion must run by **Sunday 12:00 PM (Noon) IST**.
  * **Rationale:** By Sunday End-of-Day (EOD), the Google Apps Script email automation scrapes `content.md` and sends weekly announcement emails to the `quantum-seminars` and `quantum-meets` mailing lists.
  * As a talk enters the upcoming week's horizon, automatically migrate its markdown block from `## Pipeline` up to `## Upcoming`.
  * Trigger RSS feed update (`feed.xml`) whenever talks are promoted.
  * Maintain formatting integrity: preserve line breaks before `## Pipeline` and email boundary markers (`<!-- SKIP_START -->` / `<!-- SKIP_END -->`).

### FR-4: Event Lifecycle States (Reschedules & Cancellations)
* **FR-4.1 (Rescheduled State):**
  * Update date/time and venue.
  * Adjust section placement (`Upcoming` vs `Pipeline`) based on the new date.
  * Add note `(rescheduled to [New Date])` or `(being rescheduled)`.
  * Update RSS feed with rescheduled status.
* **FR-4.2 (Cancelled - Dead State):**
  * Format heading: `### ~~[{EventType}] {Speaker}—[{Title}]({Link})~~ [CANCELLED]`.
  * Remains on `content.md` until the scheduled date elapses.
  * Automatically moves to `past.md` after the date passes.
  * **Strict Exclusion:** Never enters the video editing or YouTube publishing pipeline.

### FR-5: Video Ingestion & Intelligent Editing
* **FR-5.1 (Teams UI Spatial Processing):**
  * Dynamic bounding box tracking:
    1. Slides area ($B_{slides}$)
    2. Speaker camera ($B_{speaker}$)
    3. Participant gallery ($B_{participants}$)
  * Canvas composition:
    * Expand $B_{slides}$ to fill the left canvas completely.
    * Anchor $B_{speaker}$ at the top-right column.
    * Heavily blur the remaining participant column below the speaker for privacy.
* **FR-5.2 (Temporal Audio Trimming):**
  * **Intro Cut:** Whisper ASR spots host handoff prompt (*"you can introduce yourself and begin"*, *"welcome"*, etc.) + speaker onset.
  * **Outro Cut:** Whisper ASR spots speaker saying *"Thank you"* / closing remarks.
  * **Hard Cut:** Immediately end video; exclude all post-talk Q&A and audience interaction.
* **FR-5.3 (Checkpoint 3 - Local Review Gate):**
  * Render lightweight preview.
  * Ping reviewer; support `--set-start MM:SS`, `--set-end MM:SS`, and layout tuning.
  * Video is uploaded to YouTube **only after human approval**.

### FR-6: YouTube Publication, Metadata & Post-Publish Sync
* **FR-6.1 (Strict YouTube Metadata):**
  * **Title:** `[{EventType}] {Speaker Name} | {Talk Title}`
  * **$\le 100$ Char Title Check:** If length $>100$, propose 2-3 shortened candidates + prompt for custom title input.
  * **Description Template (Exact Standard):**
    ```markdown
    **{Talk Title}**

    *Abstract.* {Abstract Text}

    *arXiv.*: {Paper / Preprint Link}

    *About.*: {Speaker Homepage or Google Scholar Link}

    *Host.* IIIT Hyderabad
    ```
  * **Tags:** Strictly **NO TAGS** (empty tag list).
* **FR-6.2 (Staging & Checkpoint 4 - YouTube Staging Gate):**
  * Upload as **`unlisted`**.
  * Add to playlist (e.g. `Quantum Seminars 2026`).
  * Reviewer verifies unlisted video link on YouTube.
  * On sign-off, switch status to **`public`**.
* **FR-6.3 (Repository Reconciliation & RSS):**
  * In `past.md`, replace placeholder `[Teams](...)` link with `[YouTube](https://youtu.be/{videoId})`.
  * In `contribute.md`, log entry: `| {Speaker Name} | {Reviewer Name} & Quantum Bot | {Event Date} |`.
  * **Regenerate RSS Feed (`feed.xml`)**: Add the newly published talk with its YouTube URL.
  * Commit and push all updates to `main`.

### FR-7: RSS Feed Architecture & Producer Specifications
* **FR-7.1 (Dual Syndication):**
  * **Upcoming Talks Channel:** Broadcasts newly scheduled talks with Title, Speaker, Date/Time, Abstract, and Teams meeting link.
  * **Published Recordings Channel:** Broadcasts finalized YouTube recording links as soon as they are published.
* **FR-7.2 (Stable GUID & Publication Dates):**
  * Assign deterministic `<guid isPermaLink="false">` based on speaker and date (e.g. `quantum-meets-2026-11-04-daochen-wang`) so RSS reader apps never trigger duplicate alerts on subsequent markdown edits.
  * `<pubDate>` formatted per RFC-822 standard.
* **FR-7.3 (Auto-Discovery in HTML):**
  * Ensure `<link rel="alternate" type="application/rss+xml" title="Quantum Meets RSS Feed" href="https://quantum-iiit.github.io/feed.xml">` is embedded in `index.html`.
  * Surface an `[[RSS]]` link in `content.md` header alongside Google Calendar and mailing lists.

---

## 4. Human-in-the-Loop Checkpoints Summary

| Checkpoint | Trigger Point | Actions Available to Maintainer |
| :--- | :--- | :--- |
| **Checkpoint 1: Calendar Gate** | Post Google Form submission | Inspect event details & time slot; confirm venue (online vs campus default); approve Google Calendar entry. |
| **Checkpoint 2: Website Gate** | Photo scraped & face cropped, abstract converted | Inspect cropped face; verify `gh image` CDN URL; review converted Markdown abstract and Upcoming vs. Pipeline placement; approve commit to `content.md`. |
| **Checkpoint 3: Local Video Gate** | Video render complete | Review video preview; adjust `--start-time` or `--end-time`; approve for YouTube upload. |
| **Checkpoint 4: YouTube Staging Gate** | Unlisted upload complete | Review unlisted YouTube video and description; sign off to make public and sync website. |

---

## 5. Non-Functional Requirements (NFR)

* **NFR-1 (Privacy):** 100% masking/blurring of non-speaker attendees in Teams recordings.
* **NFR-2 (Clean Assets):** No repository bloat; zero image files committed to `attachments/` folder. All images hosted through `gh image` CDN (`user-attachments`).
* **NFR-3 (Execution Independence):** CLI runs locally with optional containerization; credentials kept in `.env`.
* **NFR-4 (Idempotence & Safety):** Each checkpoint saves state to `.quantum_cache/`, allowing the pipeline to pause, resume, or rerun without duplicate calendar entries or git conflicts.
