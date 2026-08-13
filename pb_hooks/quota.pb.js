/// <reference path="../pb_data/types.d.ts" />

// Per-account item cap for the "Tabtop" collection, so a shared/public login
// (e.g. a demo "test" account) can't be spammed with unlimited boards,
// widgets, and links. Admin and patron accounts are exempt.
//
// Note: each individual file (payload / cache_icon) is already capped at
// 5 MB by the collection schema itself (see pb_schema.json). This hook adds
// the missing piece: a ceiling on total *item count* per owner.

onRecordCreateRequest((e) => {
    const MAX_ITEMS_PER_OWNER = 60;

    const ownerId = e.record.get("owner");
    if (!ownerId) {
        e.next();
        return;
    }

    let exempt = false;
    try {
        const owner = e.app.findRecordById("TabtopUsers", ownerId);
        const accountType = owner.get("account_type");
        exempt = accountType === "admin" || accountType === "patron";
    } catch (err) {
        exempt = false;
    }

    if (!exempt) {
        const count = e.app.findRecordsByFilter(
            "Tabtop",
            "owner = {:owner}",
            "",
            0,
            0,
            { owner: ownerId }
        ).length;

        if (count >= MAX_ITEMS_PER_OWNER) {
            throw new BadRequestError(
                `This account is limited to ${MAX_ITEMS_PER_OWNER} items. Delete something before adding more.`
            );
        }
    }

    e.next();
}, "Tabtop");
