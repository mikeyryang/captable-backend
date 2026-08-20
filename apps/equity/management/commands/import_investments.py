"""Import Valkyrie investment data from the official summary sheet.
Dry-run by default; pass --commit to write. Pass --fund "name" to filter."""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.equity.models import Company, Fund, Investment

FUNDS = {
    "Valkyrie Fund I LP":              {"short":"Fund I",  "type":"LP",  "vintage":2021},
    "Valkyrie Fund II LP":             {"short":"Fund II", "type":"LP",  "vintage":2024},
    "Valkyrie Opportunity Fund I, LLC":{"short":"Opp I",   "type":"LLC", "vintage":2022},
    "Valkyrie Opportunity Fund LLC":   {"short":"Opp",     "type":"LLC", "vintage":2021},
    "Valkyrie Fund LP":                {"short":"Fund",    "type":"LP",  "vintage":2024},
}

# status, company, fund, date, type, principal, cap, cap_premoney, discount, int_rate,
# maturity, round, mfn, qsbs, share_price, num_shares, sector, ceo, contact, dist, review, source, conv
ROWS = [
    ("active","Touzi Data Technology, LLC","Valkyrie Fund I LP","2021-10-15","interest",100000,10000000,False,None,None,None,"",False,False,1000,100,"Bitcoin","Eng Taing","eng@touzicapital.com","","Verified","Bitcoin Mining Fund III subscription",None),
    ("active","Buoyant Aero, Inc.","Valkyrie Fund I LP","2021-11-02","safe",25000,18000000,False,None,None,None,"",False,False,None,None,"Automated Blimps","Ben Claman","","","Verified","Signed SAFE 812054v1",None),
    ("exited","Oshun Medical, Inc. dba Prenome, Inc.","Valkyrie Fund I LP","2021-11-07","note",50000,None,False,None,None,"2023-01-12","",False,False,None,None,"Medical","","","","Verified","Note terminated 1/12/2023; replaced w/ LP interest in Vol.1 Ventures",None),
    ("active","Metaloop Inc.","Valkyrie Fund I LP","2021-12-17","safe",50000,None,False,80,None,None,"",False,False,None,None,"Crypto","Xiangjun Li","jason@metaloop.world","5.15% Solayer token supply x (50000/cap), from 2/2026","Verified","Discount-only SAFE 80pct",None),
    ("exited","Symphony Dental Group, Inc.","Valkyrie Fund I LP","2022-03-01","note",25000,8000000,False,85,5,"2025-03-01","",False,False,None,None,"Dental","Farhad Sharifi","fsharifi@symphonydentalgroup.com","","Verified","Convertible note Series 2021A $3750 interest",None),
    ("active","Minitable Tech Holding Inc.","Valkyrie Fund I LP","2022-03-04","note",25000,12000000,False,None,3,"2024-01-30","",False,False,None,None,"Restaurant","Yang Pan","sean@minitable.net","","Verified","Cap amended to 12M Sept 2022 $1500 interest",None),
    ("active","Meliora Therapeutics, Inc.","Valkyrie Fund I LP","2022-06-01","priced",49999.77,None,False,None,None,None,"Seed-1",False,True,0.6352,78715,"Pharmaceuticals","Yuan Li","","","Verified","Stock purchase 78715 shares",None),
    ("active","Chemix, Inc.","Valkyrie Fund I LP","2022-06-06","priced",49999.72,5000000,False,None,None,None,"Seed-2",False,True,0.3682,135795,"Battery","Kaixiang Lin","kaixianglin@chemix.ai","","Verified","Series Seed 135795 shares",None),
    ("active","Traini, Inc.","Valkyrie Fund I LP","2022-07-28","safe",25000,2000000,False,None,None,None,"",False,False,None,None,"Pet translation","Bingyou Sun","trainipet@gmail.com","","Verified","Series SAFE July 2022",None),
    ("active","Trans Astronautica, Inc.","Valkyrie Fund I LP","2022-08-25","safe",50000,40000000,False,None,None,None,"",False,False,None,None,"Asteroid mining","Joel Sercel","joel@transastra.com","","Corrected","SAFE Aug 2022 40M cap date corrected",None),
    ("superseded","Phygtl, Inc.","Valkyrie Fund I LP","2022-10-06","safe",100000,27000000,False,80,None,None,"",False,False,None,None,"Augmented Reality","Tommaso Di Bartolo","t@phygtl.xyz","","Superseded","Terminated 2/28/2023 replaced by 2024 SAFE",None),
    ("active","Exascale Labs, Inc. (Exabits)","Valkyrie Fund I LP","2022-12-31","safe",50000,16000000,False,None,None,None,"",True,False,None,3125,"GPU IAAS","Hoansoo Lee","hoansoo@exabits.xyz","31.25M tokens at 0.0016, 18mo after launch","Verified","Cap amended 25M to 16M July 2023",None),
    ("active","Traini, Inc.","Valkyrie Fund I LP","2023-02-16","safe",50000,10000000,False,None,None,None,"",False,False,None,None,"Pet translation","Bingyou Sun","trainipet@gmail.com","","Verified","Series SAFE Feb 2023",None),
    ("active","Exascale Labs, Inc. (Exabits)","Valkyrie Fund I LP","2023-03-21","safe",50000,16000000,False,None,None,None,"",True,False,None,3125,"GPU IAAS","Hoansoo Lee","hoansoo@exabits.xyz","31.25M tokens at 0.0016, 18mo after launch","Verified","Cap amended to 16M July 2023",None),
    ("active","Minitable Tech Holding Inc.","Valkyrie Fund I LP","2023-04-06","note",50000,22000000,False,None,0,"2025-04-18","",False,False,None,None,"Restaurant","Yang Pan","sean@minitable.net","","Verified","Note April 2023 0pct interest 22M cap",None),
    ("active","Cache DNA, Inc.","Valkyrie Fund I LP","2023-05-16","priced",99999.73,None,False,None,None,None,"Seed-1",False,True,2.058031,48590,"Biomolecule Storage","Michael Becich","michael@cache-dna.com","","Verified","Series Seed 48590 shares",None),
    ("active","Integral AI","Valkyrie Fund I LP","2023-05-22","safe",100000,50000000,False,85,None,None,"",False,False,None,None,"AI model","Jad Tarifi","jad@integral.ai","","Verified","SAFE 50M post-money cap 85pct discount",None),
    ("active","Antaris, Inc.","Valkyrie Fund I LP","2023-08-23","priced",50000,None,False,None,None,None,"Seed-2",True,True,0.70726,70792,"Spacecraft Operations","Thomas Barton","tom@antaris.space","","Verified","Note 6/27/2023 converted to Seed-2 MFN",None),
    ("active","Bourbaki Intelligent Systems, Inc. dba Minerva CQ","Valkyrie Fund I LP","2023-08-25","safe",50000,15000000,False,90,None,None,"",False,False,None,None,"Contact Center AI","Cosimo Spera","cosimo@minervacq.com","","Verified","SAFE Aug 2023 15M cap 90pct discount",None),
    ("active","Agemica","Valkyrie Fund I LP","2023-12-05","note",50000,6000000,False,80,5,"2026-12-30","",False,False,None,None,"Anti-aging vaccine","Ronjon Nag","ronjon@r42group.com","","Corrected","Maturity extended to 12/30/2026 $2500 interest",None),
    ("converted","Etherdyne Technologies, Inc.","Valkyrie Fund I LP","2023-12-28","note",100000,26500000,False,70,12,None,"",False,False,None,None,"Wireless Charging","Jeff Yen","","","Verified","Converted to Series A-5 8/14/2025","A5"),
    ("active","Bourbaki Intelligent Systems, Inc. dba Minerva CQ","Valkyrie Fund I LP","2024-02-01","safe",50000,15000000,False,90,None,None,"",False,False,None,None,"Contact Center AI","Cosimo Spera","cosimo@minervacq.com","","Verified","SAFE Feb 2024 15M cap 90pct discount",None),
    ("active","Feon Energy, Inc.","Valkyrie Fund I LP","2024-02-06","priced",62999.97,None,False,None,None,None,"Seed",False,True,0.890761,70726,"Battery","Wenxiao Huang","","","Verified","Series Seed 70726 shares partial pro rata",None),
    ("active","Feon Energy, Inc.","Valkyrie Fund I LP","2024-02-06","priced",100000,None,False,None,None,None,"Seed-1",False,True,0.757147,132074,"Battery","Wenxiao Huang","","","Verified","Series Seed-1 132074 shares",None),
    ("active","Traini, Inc.","Valkyrie Fund I LP","2024-04-30","safe",50000,10000000,False,None,None,None,"",False,False,None,None,"Pet translation","Bingyou Sun","trainipet@gmail.com","","Verified","Series SAFE April 2024",None),
    ("active","Crystal Sonic, Inc.","Valkyrie Fund I LP","2024-12-04","safe",125000,15000000,True,80,None,None,"",False,False,None,None,"Wafer Manufacturing","Arno Merkle","arno@xtalsonic.com","","Verified","SAFE 15M pre-money cap 80pct discount",None),
    ("converted","Etherdyne Technologies, Inc.","Valkyrie Fund I LP","2025-01-04","note",50000,26500000,False,70,12,None,"",False,False,None,None,"Wireless Charging","Jeff Yen","","","Verified","Converted to Series A-5 8/14/2025","A5"),
    ("active","Ferveret Inc.","Valkyrie Fund I LP","2025-02-28","priced",250000,None,False,None,None,None,"Seed-3",False,True,1.1818,211541,"Data Center Cooling","Reza Azizian","reza@ferveret.com","","Verified","SAFE 12/21/2023 converted to Seed-3",None),
    ("active","Ferveret Inc.","Valkyrie Fund I LP","2025-02-28","priced",50000,None,False,None,None,None,"Seed-2",False,True,0.50506,98998,"Data Center Cooling","Reza Azizian","reza@ferveret.com","","Verified","SAFE 5/24/2021 converted to Seed-2",None),
    ("converted","Etherdyne Technologies, Inc.","Valkyrie Fund I LP","2025-06-04","note",50000,26500000,False,70,12,None,"",False,False,None,None,"Wireless Charging","Jeff Yen","","","Verified","Converted to Series A-5 8/14/2025","A5"),
    ("active","Night Street Games LLC","Valkyrie Fund I LP","2022-11-01","priced",25000,43252785,False,None,None,None,"Seed",False,True,6.637,3767,"Video Game Studio","Mac Reynolds","","","Verified","Via Gaingels 3767 shares projected",None),
    ("active","Palmetto Clean Technology, Inc.","Valkyrie Fund I LP","2021-11-23","priced",25000,1209547835,False,None,None,None,"C-1",False,False,7.3279,3411,"Solar Energy","Christopher Kemper","","","Verified","Via Gaingels Series C-1",None),
    ("exited","TFH, LLC","Valkyrie Fund I LP","2022-02-14","priced",10000,2999999792,False,None,None,None,"B",False,False,292.6515,34,"AI and Humanity","Alex Blania","","14110.50 (5.5x est MOIC)","Verified","Via Gaingels Tools For Humanity Worldcoin",None),
    ("active","ZFlow, Inc","Valkyrie Fund II LP","2024-12-02","safe",100000,15000000,False,80,None,None,"",False,False,None,None,"AI Deployment","Zhibin Xiao","zhibinxiao@gmail.com","","Verified","Assigned from Jinpei Li to Fund II 2/10/2026",None),
    ("active","Zillion Network, Inc.","Valkyrie Fund II LP","2024-12-09","safe",200000,16000000,False,None,None,None,"",False,False,None,None,"GPU IAAS","Xue Wu","info@zillionnetwork.com","","Verified","SAFE 16M post-money cap",None),
    ("active","AGIGA, Inc.","Valkyrie Fund II LP","2025-01-20","safe",25000,6000000,False,80,None,None,"",False,False,None,None,"Smart Glasses","Xiaoran Wang","xiaoranw@agiga.ai","","Verified","SAFE 6M post-money cap 80pct discount",None),
    ("active","Cbricksdata International LTD (DeAgent AI)","Valkyrie Fund II LP","2025-04-08","safe",50000,50000000,False,None,None,None,"",False,False,None,None,"Crypto","","selwyn@deagent.ai","Token warrant exercisable after token structuring events","Verified","SAFE 50M post-money cap token warrant unquantified",None),
    ("active","Q3D Sensing, Inc.","Valkyrie Fund II LP","2025-04-18","safe",100000,18000000,True,80,None,None,"",False,False,None,None,"3D Sensing","Tianyue Yu","tianyue.yu@q3dsensing.com","","Verified","SAFE 18M pre-money cap 80pct discount",None),
    ("active","Feon Energy, Inc.","Valkyrie Opportunity Fund I, LLC","2022-10-18","safe",950000,20000000,False,85,None,None,"",False,False,None,None,"Battery","Wenxiao Huang","wenxiao.huang@elyte.tech","","Verified","A&R SAFE eLyte SPV 20M post-money cap 85pct",None),
    ("active","Feon Energy, Inc.","Valkyrie Opportunity Fund I, LLC","2024-02-06","priced",950000,None,False,None,None,None,"Seed-1",False,True,0.757147,1254710,"Battery","Wenxiao Huang","","","Verified","Series Seed-1 1254710 shares",None),
    ("active","Shima Capital LLC","Valkyrie Opportunity Fund LLC","2021-08-13","interest",200000,None,False,None,None,None,"",False,False,None,None,"VC","Yida Gao","","","Verified","Capital commitment to Shima Capital",None),
    ("active","Lyte Charging Inc.","Valkyrie Opportunity Fund LLC","2021-09-28","priced",199999.57,None,False,None,None,None,"Seed",False,False,0.772059,259047,"Portable Charging","Dajiang Wei","","","Verified","Series Seed 259047 shares",None),
    ("active","Ferveret Inc.","Valkyrie Opportunity Fund LLC","2025-02-28","priced",250000,None,False,None,None,None,"Seed-3",False,True,1.1818,211541,"Data Center Cooling","Reza Azizian","reza@ferveret.com","","Verified","SAFE 9/8/2021 converted to Seed-3",None),
    ("active","Trans Astronautica, Inc.","Valkyrie Fund LP","2024-05-17","safe",50000,40000000,False,None,None,None,"",False,False,None,None,"Asteroid mining","Joel Sercel","joel@transastra.com","","Verified","SAFE Ignite Phase 2E entity name flagged",None),
    ("active","Feon Energy, Inc.","Valkyrie Fund I LP","2022-08-24","safe",100000,15000000,False,85,None,None,"",False,False,None,None,"Battery","Wenxiao Huang","wenxiao.huang@elyte.ai","","NEW","eLyte SAFE to Fund I 15M post-money cap 85pct",None),
    ("active","Phygtl, Inc.","Valkyrie Fund I LP","2024-08-09","safe",50000,16000000,False,80,None,None,"",False,False,None,None,"Augmented Reality","Tommaso Di Bartolo","t@phygtl.xyz","","NEW","Replacement SAFE for terminated 2022 position",None),
    ("active","Bourbaki Intelligent Systems, Inc. dba Minerva CQ","Valkyrie Fund I LP","2025-08-25","note",25000,None,False,None,20,"2026-08-26","",False,False,None,None,"Contact Center AI","Cosimo Spera","cosimo@minervacq.com","","NEW","2025 bridge note 20pct year",None),
    ("active","Etherdyne Technologies, Inc.","Valkyrie Fund I LP","2025-08-14","priced",243983.53,None,False,None,None,None,"Series A-5",False,False,1.74385,139908,"Wireless Charging","Jeff Yen","","","NEW","Aggregate conversion 3 notes to Series A-5","A5_TARGET"),
    ("active","Zillion Network, Inc.","Valkyrie Fund II LP","2025-07-31","safe",400000,25000000,False,80,None,None,"",False,False,None,None,"GPU IAAS","Xue Wu","info@zillionnetwork.com","","NEW","Second SAFE 25M post-money cap",None),
    ("active","AGIGA, Inc.","Valkyrie Fund II LP","2025-09-19","safe",50000,15000000,False,None,None,None,"",False,False,None,None,"Smart Glasses","Xiaoran Wang","xiaoranw@agiga.ai","","NEW","Second SAFE 15M post-money cap",None),
    ("active","Agos Inc","Valkyrie Fund II LP","2025-12-31","safe",50000,10000000,False,None,None,None,"",True,False,None,None,"","","","","NEW","SAFE 10M post-money cap MFN side letter",None),
    ("active","CICADA Foundation (Token SAFT)","Valkyrie Fund II LP","2025-08-10","token",30000,None,False,None,None,None,"",False,False,None,None,"Crypto","","","10M rtCIC tokens TGE 7/9/2025 rebase-yield","NEW","Token SAFT",None),
    ("active","Healmint, Inc","Valkyrie Fund II LP","2025-09-20","safe",50000,10000000,False,None,None,None,"",False,False,None,None,"","","","","NEW","Pre-seed SAFE 10M post-money cap",None),
    ("active","Intelligent Racing Inc.","Valkyrie Fund II LP","2026-04-12","note",200000,None,False,None,6,"2028-04-12","",False,False,None,None,"","","","","NEW","Convertible note 6pct year 24mo maturity",None),
]


class Command(BaseCommand):
    help = "Import Valkyrie investment data from the official summary sheet"

    def add_arguments(self, parser):
        parser.add_argument("--commit", action="store_true", help="Write to DB (default dry-run)")
        parser.add_argument("--fund", type=str, default=None, help="Only import one fund by name")

    def handle(self, *args, **opts):
        commit = opts["commit"]
        only   = opts["fund"]
        rows   = [r for r in ROWS if (not only or r[2] == only)]

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\n{'COMMIT' if commit else 'DRY RUN'} - {len(rows)} rows"
            + (f" (filtered to {only})" if only else "")))

        companies, funds_seen = {}, {}
        for r in rows:
            companies.setdefault(r[1], []).append(r)
            funds_seen[r[2]] = funds_seen.get(r[2], 0) + 1

        self.stdout.write(self.style.HTTP_INFO(f"\nFunds ({len(funds_seen)}):"))
        for fn, cnt in funds_seen.items():
            self.stdout.write(f"  - {fn}: {cnt} investments")

        self.stdout.write(self.style.HTTP_INFO(f"\nCompanies ({len(companies)}):"))
        total = 0
        for cn, crows in sorted(companies.items()):
            inv = sum(r[5] for r in crows if isinstance(r[5], (int, float)))
            total += inv
            statuses = set(r[0] for r in crows)
            flag = ""
            if len(crows) > 1: flag += f" [{len(crows)} investments]"
            if "converted" in statuses:  flag += " [conversions]"
            if "superseded" in statuses: flag += " [superseded]"
            if "exited" in statuses:     flag += " [exit]"
            self.stdout.write(f"  - {cn}: ${inv:,.0f}{flag}")

        self.stdout.write(self.style.SUCCESS(f"\nTotal principal across rows: ${total:,.2f}"))

        by_status = {}
        for r in rows: by_status[r[0]] = by_status.get(r[0], 0) + 1
        self.stdout.write(self.style.HTTP_INFO("\nStatus breakdown:"))
        for s, c in by_status.items():
            self.stdout.write(f"  - {s}: {c}")

        if not commit:
            self.stdout.write(self.style.WARNING(
                "\nDRY RUN complete. Nothing written. Re-run with --commit to write.\n"))
            return

        with transaction.atomic():
            fund_objs = {}
            for fname, meta in FUNDS.items():
                if only and fname != only: continue
                f, created = Fund.objects.get_or_create(
                    name=fname,
                    defaults=dict(short_name=meta["short"], entity_type=meta["type"], vintage_year=meta["vintage"]))
                fund_objs[fname] = f
                self.stdout.write(("  + created " if created else "  = exists  ") + f"Fund: {fname}")

            comp_objs = {}
            for cn in companies:
                c, created = Company.objects.get_or_create(name=cn)
                comp_objs[cn] = c
                if created: self.stdout.write(f"  + created Company: {cn}")

            a5_sources, a5_target = [], None
            for r in rows:
                (status, cn, fn, date, itype, principal, cap, cap_pre, disc, irate,
                 maturity, rnd, mfn, qsbs, sprice, nshares, sector, ceo, contact,
                 dist, review, source, conv) = r
                if fn not in fund_objs: continue
                inv = Investment.objects.create(
                    fund=fund_objs[fn], company=comp_objs[cn],
                    instrument_type=itype, status=status, date=date or None,
                    principal_cents=int(round((principal or 0) * 100)),
                    cap_cents=int(round(cap * 100)) if cap else None,
                    cap_is_premoney=cap_pre,
                    discount_pct=Decimal(str(disc)) if disc is not None else None,
                    interest_rate_pct=Decimal(str(irate)) if irate is not None else None,
                    maturity_date=maturity or None, mfn=mfn, qsbs=qsbs, round_name=rnd or "",
                    share_price=Decimal(str(sprice)) if sprice is not None else None,
                    num_shares=nshares, sector=sector or "", ceo_name=ceo or "",
                    company_contact=contact or "", distributions_note=dist or "",
                    source_notes=source or "", review_status=review or "")
                if conv == "A5":        a5_sources.append(inv)
                if conv == "A5_TARGET": a5_target = inv

            if a5_target and a5_sources:
                for s in a5_sources:
                    s.converted_into = a5_target
                    s.save(update_fields=["converted_into"])
                self.stdout.write(self.style.SUCCESS(
                    f"\n  Linked {len(a5_sources)} Etherdyne notes -> Series A-5"))

        self.stdout.write(self.style.SUCCESS(
            f"\nCOMMIT complete. {Fund.objects.count()} funds, "
            f"{Company.objects.count()} companies, {Investment.objects.count()} investments.\n"))
